// server.js (Express backend)
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db.js"; // your Knex connection

const app = express();
app.use(cors());
app.use(express.json());

const SECRET_KEY = process.env.JWT_SECRET || "dev-secret-key";
const PORT = Number(process.env.PORT || 5000);

async function ensureUserRoleColumn() {
  const hasRoleColumn = await db.schema.hasColumn("users", "role");
  if (!hasRoleColumn) {
    await db.schema.alterTable("users", (table) => {
      table.string("role", 20).notNullable().defaultTo("user");
    });
  }
}

async function ensureUserDeletedAtColumn() {
  const hasDeletedAtColumn = await db.schema.hasColumn("users", "deleted_at");
  if (!hasDeletedAtColumn) {
    await db.schema.alterTable("users", (table) => {
      table.timestamp("deleted_at").nullable();
    });
  }
}

async function ensureUserAuditTable() {
  const hasAuditTable = await db.schema.hasTable("user_audit_logs");
  if (!hasAuditTable) {
    await db.schema.createTable("user_audit_logs", (table) => {
      table.increments("id").primary();
      table.string("action", 20).notNullable();
      table.integer("target_user_id").nullable();
      table.string("target_username", 50).notNullable();
      table.string("target_email", 255).nullable();
      table.string("target_role", 20).nullable();
      table.integer("performed_by_user_id").nullable();
      table.string("performed_by_username", 50).nullable();
      table.timestamp("created_at").defaultTo(db.fn.now());
    });
  }
}

async function logUserAuditEvent({
  action,
  targetUserId = null,
  targetUsername,
  targetEmail = null,
  targetRole = null,
  performedByUserId = null,
  performedByUsername = null,
}) {
  await db("user_audit_logs").insert({
    action,
    target_user_id: targetUserId,
    target_username: targetUsername,
    target_email: targetEmail,
    target_role: targetRole,
    performed_by_user_id: performedByUserId,
    performed_by_username: performedByUsername,
  });
}

function createAuthToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role || "user" },
    SECRET_KEY,
    { expiresIn: "1h" }
  );
}

// ✅ Helper: Password strength validation
function isStrongPassword(password) {
  const minLength = 8;
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/;
  return password.length >= minLength && regex.test(password);
}

// ✅ Middleware: Verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Invalid token" });
    req.user = decoded;
    next();
  });
}

async function requireAdmin(req, res, next) {
  try {
    const user = await db("users")
      .select("role")
      .where({ id: req.user.id })
      .whereNull("deleted_at")
      .first();
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  } catch (err) {
    console.error("Admin auth error:", err);
    res.status(500).json({ error: "Server error while checking admin access" });
  }
}

// ✅ Register endpoint
app.post("/api/register", async (req, res) => {
  const { firstName, lastName, email, username, password, gender, dob, role } =
    req.body;

  try {
    const [{ count: userCountRaw }] = await db("users").whereNull("deleted_at").count("* as count");
    const hasUsers = Number(userCountRaw || 0) > 0;

    let assignedRole = "admin";
    let requestingUserId = null;
    let requestingUsername = null;
    if (hasUsers) {
      const authHeader = req.headers["authorization"];
      if (!authHeader) {
        return res.status(401).json({ error: "Only admins can create new users" });
      }
      const token = authHeader.split(" ")[1];
      let decoded;
      try {
        decoded = jwt.verify(token, SECRET_KEY);
      } catch {
        return res.status(401).json({ error: "Invalid token" });
      }

      const requestingUser = await db("users")
        .select("id", "username", "role")
        .where({ id: decoded.id })
        .whereNull("deleted_at")
        .first();
      if (!requestingUser || requestingUser.role !== "admin") {
        return res.status(403).json({ error: "Only admins can create new users" });
      }
      requestingUserId = requestingUser.id;
      requestingUsername = requestingUser.username;

      const requestedRole = String(role || "user").toLowerCase();
      assignedRole = requestedRole === "admin" ? "admin" : "user";
    }

    // Check if email or username already exists
    const existingUser = await db("users")
      .where({ username })
      .orWhere({ email })
      .first();

    if (existingUser) {
      return res.status(400).json({ error: "Username or email already taken" });
    }

    // Validate password strength
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const [newUser] = await db("users")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        username,
        password: hashedPassword, // column is `password`
        role: assignedRole,
        gender,
        dob,
      })
      .returning(["id", "username", "email", "first_name", "role"]);

    await logUserAuditEvent({
      action: "added",
      targetUserId: newUser.id,
      targetUsername: newUser.username,
      targetEmail: newUser.email,
      targetRole: newUser.role || "user",
      performedByUserId: requestingUserId,
      performedByUsername: requestingUsername,
    });

    // ✅ Issue JWT immediately
    const token = createAuthToken(newUser);

    res.json({
      message: "User registered successfully",
      user: newUser,
      role: newUser.role || "user",
      token,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// ✅ Login endpoint
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await db("users")
      .select("id", "username", "password", "first_name", "last_name", "role")
      .where({ username })
      .whereNull("deleted_at")
      .first();
    if (!user) return res.status(401).json({ error: "User not found" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: "Invalid password" });

    const token = createAuthToken(user);

    res.json({
      token,
      username: user.username,
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      role: user.role || "user",
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ✅ Profile endpoint (protected)
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const user = await db("users")
      .select("id", "username", "first_name", "last_name", "role")
      .where({ id: req.user.id })
      .whereNull("deleted_at")
      .first();

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      id: user.id,
      username: user.username,
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      role: user.role || "user",
    });
  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).json({ error: "Server error while fetching profile" });
  }
});

app.post("/api/change-password", authenticateToken, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required" });
  }
  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    return res.status(400).json({ error: "New password and confirm password do not match" });
  }
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({
      error:
        "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character",
    });
  }

  try {
    const user = await db("users")
      .select("id", "password")
      .where({ id: req.user.id })
      .whereNull("deleted_at")
      .first();
    if (!user) return res.status(404).json({ error: "User not found" });

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ error: "New password must be different from current password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db("users").where({ id: req.user.id }).update({ password: hashedPassword });

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Server error while changing password" });
  }
});

app.get("/api/admin/summary", authenticateToken, requireAdmin, async (req, res) => {
  void req;
  try {
    const [{ count: totalCount }] = await db("users").whereNull("deleted_at").count("* as count");
    const [{ count: adminCount }] = await db("users")
      .where({ role: "admin" })
      .whereNull("deleted_at")
      .count("* as count");
    const [{ count: userCount }] = await db("users")
      .where({ role: "user" })
      .whereNull("deleted_at")
      .count("* as count");
    const [{ count: deletedCount }] = await db("users").whereNotNull("deleted_at").count("* as count");

    res.json({
      totalUsers: Number(totalCount || 0),
      adminUsers: Number(adminCount || 0),
      standardUsers: Number(userCount || 0),
      deletedUsers: Number(deletedCount || 0),
    });
  } catch (err) {
    console.error("Admin summary error:", err);
    res.status(500).json({ error: "Server error while fetching admin summary" });
  }
});

app.get("/api/admin/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await db("users")
      .select("id", "first_name", "last_name", "username", "email", "role", "created_at", "deleted_at")
      .orderBy("created_at", "desc");

    const currentUserId = req.user.id;
    res.json({
      users: users.map((user) => ({
        id: user.id,
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        username: user.username,
        email: user.email,
        role: user.role || "user",
        createdAt: user.created_at,
        deletedAt: user.deleted_at,
        isDeleted: Boolean(user.deleted_at),
        isCurrentUser: user.id === currentUserId,
      })),
    });
  } catch (err) {
    console.error("Admin users list error:", err);
    res.status(500).json({ error: "Server error while fetching users" });
  }
});

app.patch("/api/admin/users/:id/role", authenticateToken, requireAdmin, async (req, res) => {
  const targetUserId = Number(req.params.id);
  const nextRole = String(req.body?.role || "").toLowerCase();

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  if (nextRole !== "user" && nextRole !== "admin") {
    return res.status(400).json({ error: "Role must be either user or admin" });
  }

  try {
    const targetUser = await db("users")
      .select("id", "role", "deleted_at")
      .where({ id: targetUserId })
      .first();
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (targetUser.id === req.user.id && nextRole !== "admin") {
      return res.status(400).json({ error: "You cannot remove your own admin role" });
    }
    if (targetUser.deleted_at) {
      return res.status(400).json({ error: "Cannot change role for a soft-deleted user" });
    }

    if (targetUser.role === nextRole) {
      return res.json({ message: "Role unchanged", role: targetUser.role });
    }

    await db("users").where({ id: targetUserId }).update({ role: nextRole });
    res.json({ message: "Role updated successfully", role: nextRole });
  } catch (err) {
    console.error("Admin role update error:", err);
    res.status(500).json({ error: "Server error while updating role" });
  }
});

app.patch("/api/admin/users/:id/soft-delete", authenticateToken, requireAdmin, async (req, res) => {
  const targetUserId = Number(req.params.id);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const targetUser = await db("users")
      .select("id", "username", "email", "role", "deleted_at")
      .where({ id: targetUserId })
      .first();
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: "You cannot remove your own account" });
    }
    if (targetUser.deleted_at) {
      return res.status(400).json({ error: "User is already soft-deleted" });
    }

    if (targetUser.role === "admin") {
      const [{ count: adminCountRaw }] = await db("users")
        .where({ role: "admin" })
        .whereNull("deleted_at")
        .count("* as count");
      const adminCount = Number(adminCountRaw || 0);
      if (adminCount <= 1) {
        return res.status(400).json({ error: "At least one admin account must remain" });
      }
    }

    await db("users").where({ id: targetUser.id }).update({ deleted_at: db.fn.now() });
    await logUserAuditEvent({
      action: "removed",
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
      targetEmail: targetUser.email || null,
      targetRole: targetUser.role || "user",
      performedByUserId: req.user.id,
      performedByUsername: req.user.username || null,
    });

    res.json({ message: "User soft-deleted successfully" });
  } catch (err) {
    console.error("Admin user soft delete error:", err);
    res.status(500).json({ error: "Server error while soft-deleting user" });
  }
});

app.patch("/api/admin/users/:id/restore", authenticateToken, requireAdmin, async (req, res) => {
  const targetUserId = Number(req.params.id);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const targetUser = await db("users")
      .select("id", "username", "deleted_at")
      .where({ id: targetUserId })
      .first();
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!targetUser.deleted_at) {
      return res.status(400).json({ error: "User is not soft-deleted" });
    }

    await db("users").where({ id: targetUser.id }).update({ deleted_at: null });
    res.json({ message: "User restored successfully" });
  } catch (err) {
    console.error("Admin user restore error:", err);
    res.status(500).json({ error: "Server error while restoring user" });
  }
});

app.delete("/api/admin/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  const targetUserId = Number(req.params.id);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const targetUser = await db("users")
      .select("id", "username", "email", "role", "deleted_at")
      .where({ id: targetUserId })
      .first();
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: "You cannot remove your own account" });
    }

    if (targetUser.role === "admin" && !targetUser.deleted_at) {
      const [{ count: adminCountRaw }] = await db("users")
        .where({ role: "admin" })
        .whereNull("deleted_at")
        .count("* as count");
      const adminCount = Number(adminCountRaw || 0);
      if (adminCount <= 1) {
        return res.status(400).json({ error: "At least one admin account must remain" });
      }
    }

    await db("users").where({ id: targetUser.id }).del();
    await logUserAuditEvent({
      action: "removed",
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
      targetEmail: targetUser.email || null,
      targetRole: targetUser.role || "user",
      performedByUserId: req.user.id,
      performedByUsername: req.user.username || null,
    });

    res.json({ message: "User permanently deleted" });
  } catch (err) {
    console.error("Admin user hard delete error:", err);
    res.status(500).json({ error: "Server error while permanently deleting user" });
  }
});

app.get("/api/admin/user-audit", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
    const logs = await db("user_audit_logs")
      .select(
        "id",
        "action",
        "target_user_id",
        "target_username",
        "target_email",
        "target_role",
        "performed_by_user_id",
        "performed_by_username",
        "created_at"
      )
      .orderBy("created_at", "desc")
      .limit(limit);

    res.json({
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        targetUserId: log.target_user_id,
        targetUsername: log.target_username,
        targetEmail: log.target_email,
        targetRole: log.target_role,
        performedByUserId: log.performed_by_user_id,
        performedByUsername: log.performed_by_username,
        createdAt: log.created_at,
      })),
    });
  } catch (err) {
    console.error("Admin user audit fetch error:", err);
    res.status(500).json({ error: "Server error while fetching user audit logs" });
  }
});

// ✅ Start server
ensureUserRoleColumn()
  .then(() => ensureUserDeletedAtColumn())
  .then(() => ensureUserAuditTable())
  .then(() => {
    app.listen(PORT, () =>
      console.log(`✅ Server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("Server startup failed:", err);
    process.exit(1);
  });

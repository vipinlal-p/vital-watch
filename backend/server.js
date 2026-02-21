// server.js (Express backend)
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import bodyParser from "body-parser";
import { db } from "./db.js"; // your Knex connection

const app = express();
app.use(cors());
app.use(bodyParser.json());

const SECRET_KEY = process.env.JWT_SECRET || "dev-secret-key";
const PORT = Number(process.env.PORT || 5000);

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

// ✅ Register endpoint
app.post("/api/register", async (req, res) => {
  const { firstName, lastName, email, username, password, gender, dob } =
    req.body;

  try {
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
        gender,
        dob,
      })
      .returning(["id", "username", "email", "first_name"]);

    // ✅ Issue JWT immediately
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username },
      SECRET_KEY,
      { expiresIn: "1h" }
    );

    res.json({
      message: "User registered successfully",
      user: newUser,
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
    const user = await db("users").where({ username }).first();
    if (!user) return res.status(401).json({ error: "User not found" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      SECRET_KEY,
      { expiresIn: "1h" }
    );

    res.json({ token, username: user.username });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ✅ Profile endpoint (protected)
app.get("/api/profile", authenticateToken, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

// ✅ Get all police stations (protected)
app.get("/api/police-stations", authenticateToken, async (req, res) => {
  try {
    const stations = await db("police_stations")
      .select("station_id", "station_name")
      .orderBy("station_name", "asc");
    res.json(stations);
  } catch (err) {
    console.error("Error fetching stations:", err);
    res.status(500).json({ error: "Failed to fetch police stations" });
  }
});

// ✅ Add or update crime record (protected)
app.post("/api/crime-records", authenticateToken, async (req, res) => {
  const { station_id, crime_type, year, crime_count } = req.body;

  try {
    if (!station_id || !crime_type || !year || !crime_count) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if a record already exists
    const existing = await db("crime_records")
      .where({ station_id, crime_type, year })
      .first();

    if (existing) {
      // Update existing record
      await db("crime_records")
        .where({ station_id, crime_type, year })
        .update({ crime_count });

      return res.json({ success: true, message: "Crime record updated" });
    } else {
      // Insert new record
      await db("crime_records").insert({
        station_id,
        crime_type,
        year,
        crime_count,
      });

      return res.json({ success: true, message: "Crime record added" });
    }
  } catch (err) {
    console.error("Error saving crime record:", err);
    res.status(500).json({ error: "Failed to save crime record" });
  }
});

// ✅ Start server
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);

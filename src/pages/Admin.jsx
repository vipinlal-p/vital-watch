import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiUrl } from "/src/config/endpoints";

function MetricCard({ label, value }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "16px",
      }}
    >
      <div style={{ color: "#6b7280", fontSize: "13px", fontWeight: 600 }}>{label}</div>
      <div style={{ color: "#111827", fontSize: "30px", fontWeight: 700, marginTop: "8px" }}>
        {value}
      </div>
    </div>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [summary, setSummary] = useState({
    totalUsers: 0,
    adminUsers: 0,
    standardUsers: 0,
    deletedUsers: 0,
  });
  const [users, setUsers] = useState([]);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [removingUserId, setRemovingUserId] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createSuccess, setCreateSuccess] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [newUser, setNewUser] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    password: "",
    gender: "",
    dob: "",
    role: "user",
  });

  const token = useMemo(() => localStorage.getItem("token"), []);

  const loadAdminData = useCallback(async () => {
    if (!token) {
      navigate("/");
      return;
    }

    setLoading(true);
    setError("");
    setForbidden(false);

    try {
      const [profileRes, summaryRes, usersRes, auditRes] = await Promise.all([
        fetch(apiUrl("/api/profile"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/api/admin/summary"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(apiUrl("/api/admin/users"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/api/admin/user-audit?limit=100"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (profileRes.status === 401) {
        localStorage.removeItem("token");
        navigate("/");
        return;
      }
      if (!profileRes.ok) {
        throw new Error("Unable to verify profile");
      }

      const profile = await profileRes.json();
      if (profile.role !== "admin") {
        setForbidden(true);
        return;
      }

      if (!summaryRes.ok || !usersRes.ok || !auditRes.ok) {
        if (summaryRes.status === 403 || usersRes.status === 403 || auditRes.status === 403) {
          setForbidden(true);
          return;
        }
        throw new Error("Unable to fetch admin data");
      }

      const summaryData = await summaryRes.json();
      const usersData = await usersRes.json();
      const auditData = await auditRes.json();

      setSummary({
        totalUsers: Number(summaryData.totalUsers || 0),
        adminUsers: Number(summaryData.adminUsers || 0),
        standardUsers: Number(summaryData.standardUsers || 0),
        deletedUsers: Number(summaryData.deletedUsers || 0),
      });
      setUsers(Array.isArray(usersData.users) ? usersData.users : []);
      setAuditLogs(Array.isArray(auditData.logs) ? auditData.logs : []);
    } catch (err) {
      console.error("Admin page load error:", err);
      setError("Unable to load admin data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [navigate, token]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleRoleChange = async (userId, role) => {
    if (!token) return;

    setUpdatingUserId(userId);
    setError("");
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${userId}/role`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Role update failed");
      }
      setUsers((prevUsers) => {
        const updatedUsers = prevUsers.map((user) =>
          user.id === userId ? { ...user, role } : user
        );
        const admins = updatedUsers.reduce(
          (count, user) => count + (user.role === "admin" ? 1 : 0),
          0
        );
        setSummary((prev) => {
          const total = prev.totalUsers || updatedUsers.length;
          return {
            ...prev,
            totalUsers: total,
            adminUsers: admins,
            standardUsers: Math.max(total - admins, 0),
          };
        });
        return updatedUsers;
      });
    } catch (err) {
      console.error("Admin role change error:", err);
      setError(err.message || "Unable to update role");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRemoveUser = async (user) => {
    if (!token || !user?.id) return;

    const confirmed = window.confirm(`Soft-delete user "${user.username}"?`);
    if (!confirmed) return;

    setRemovingUserId(user.id);
    setError("");
    setActionSuccess("");
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${user.id}/soft-delete`), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to remove user");
      }
      setActionSuccess(`User "${user.username}" soft-deleted.`);
      await loadAdminData();
    } catch (err) {
      console.error("Remove user error:", err);
      setError(err.message || "Unable to remove user");
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleRestoreUser = async (user) => {
    if (!token || !user?.id) return;
    setRemovingUserId(user.id);
    setError("");
    setActionSuccess("");
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${user.id}/restore`), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to restore user");
      setActionSuccess(`User "${user.username}" restored.`);
      await loadAdminData();
    } catch (err) {
      console.error("Restore user error:", err);
      setError(err.message || "Unable to restore user");
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleHardDeleteUser = async (user) => {
    if (!token || !user?.id) return;
    const confirmed = window.confirm(
      `Permanently delete "${user.username}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setRemovingUserId(user.id);
    setError("");
    setActionSuccess("");
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${user.id}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to permanently delete user");
      setActionSuccess(`User "${user.username}" permanently deleted.`);
      await loadAdminData();
    } catch (err) {
      console.error("Hard delete user error:", err);
      setError(err.message || "Unable to permanently delete user");
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleNewUserChange = (e) => {
    const { name, value } = e.target;
    setNewUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!token) return;

    setCreatingUser(true);
    setError("");
    setCreateSuccess("");
    try {
      const res = await fetch(apiUrl("/api/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to create user");
      }

      setNewUser({
        firstName: "",
        lastName: "",
        email: "",
        username: "",
        password: "",
        gender: "",
        dob: "",
        role: "user",
      });
      setCreateSuccess(`User "${data?.user?.username || "new user"}" created.`);
      await loadAdminData();
    } catch (err) {
      console.error("Create user error:", err);
      setError(err.message || "Unable to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(140deg, rgba(236,253,245,1) 0%, rgba(239,246,255,1) 55%, rgba(254,242,242,1) 100%)",
        padding: "24px 18px",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "32px", color: "#111827" }}>Admin Panel</h1>
            <p style={{ marginTop: "8px", color: "#4b5563" }}>
              Manage registered users and access levels.
            </p>
          </div>
          <Link
            to="/"
            style={{
              textDecoration: "none",
              color: "#1d4ed8",
              fontWeight: 600,
              background: "#ffffff",
              border: "1px solid #bfdbfe",
              padding: "9px 12px",
              borderRadius: "10px",
            }}
          >
            Back to map
          </Link>
        </div>

        {loading && <p style={{ color: "#374151", marginTop: "20px" }}>Loading admin data...</p>}

        {!loading && forbidden && (
          <div
            style={{
              marginTop: "20px",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: "12px",
              padding: "14px",
              color: "#9a3412",
            }}
          >
            You do not have admin access to this panel.
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              marginTop: "20px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "12px",
              padding: "14px",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        )}

        {!loading && actionSuccess && (
          <div
            style={{
              marginTop: "20px",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "12px",
              padding: "14px",
              color: "#065f46",
            }}
          >
            {actionSuccess}
          </div>
        )}

        {!loading && !forbidden && (
          <>
            <div
              style={{
                marginTop: "20px",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                background: "#ffffff",
                padding: "16px",
              }}
            >
              <h2 style={{ margin: 0, color: "#111827", fontSize: "18px" }}>Add User</h2>
              <p style={{ marginTop: "6px", marginBottom: "12px", color: "#6b7280", fontSize: "13px" }}>
                Only admins can create user accounts.
              </p>
              <form
                onSubmit={handleCreateUser}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "10px",
                }}
              >
                <input
                  name="firstName"
                  value={newUser.firstName}
                  onChange={handleNewUserChange}
                  placeholder="First name"
                  style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 10px" }}
                />
                <input
                  name="lastName"
                  value={newUser.lastName}
                  onChange={handleNewUserChange}
                  placeholder="Last name"
                  style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 10px" }}
                />
                <input
                  type="email"
                  name="email"
                  required
                  value={newUser.email}
                  onChange={handleNewUserChange}
                  placeholder="Email"
                  style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 10px" }}
                />
                <input
                  name="username"
                  required
                  value={newUser.username}
                  onChange={handleNewUserChange}
                  placeholder="Username"
                  style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 10px" }}
                />
                <input
                  type="password"
                  name="password"
                  required
                  value={newUser.password}
                  onChange={handleNewUserChange}
                  placeholder="Password"
                  style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 10px" }}
                />
                <input
                  type="date"
                  name="dob"
                  value={newUser.dob}
                  onChange={handleNewUserChange}
                  style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 10px" }}
                />
                <select
                  name="gender"
                  value={newUser.gender}
                  onChange={handleNewUserChange}
                  style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 10px" }}
                >
                  <option value="">Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                <select
                  name="role"
                  value={newUser.role}
                  onChange={handleNewUserChange}
                  style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 10px" }}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={creatingUser}
                  style={{
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 12px",
                    background: creatingUser ? "#9ca3af" : "#2563eb",
                    color: "#ffffff",
                    fontWeight: 600,
                    cursor: creatingUser ? "not-allowed" : "pointer",
                  }}
                >
                  {creatingUser ? "Creating..." : "Create User"}
                </button>
              </form>
              {createSuccess ? (
                <div
                  style={{
                    marginTop: "10px",
                    background: "#ecfdf5",
                    color: "#065f46",
                    border: "1px solid #a7f3d0",
                    borderRadius: "8px",
                    padding: "9px 10px",
                    fontSize: "13px",
                  }}
                >
                  {createSuccess}
                </div>
              ) : null}
            </div>

            <div
              style={{
                marginTop: "20px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
              }}
            >
              <MetricCard label="Total Users" value={summary.totalUsers} />
              <MetricCard label="Admin Users" value={summary.adminUsers} />
              <MetricCard label="Standard Users" value={summary.standardUsers} />
              <MetricCard label="Deleted Users" value={summary.deletedUsers} />
            </div>

            <div
              style={{
                marginTop: "18px",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                overflowX: "auto",
                background: "#ffffff",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", color: "#374151", fontSize: "13px" }}>
                    <th style={{ textAlign: "left", padding: "12px" }}>Name</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Username</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Email</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Joined</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Role</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
                    return (
                      <tr key={user.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "12px", color: "#111827" }}>
                          {fullName || "Unknown"}
                          {user.isCurrentUser ? (
                            <span
                              style={{
                                marginLeft: "8px",
                                fontSize: "11px",
                                color: "#047857",
                                background: "#ecfdf5",
                                border: "1px solid #a7f3d0",
                                borderRadius: "9999px",
                                padding: "2px 8px",
                              }}
                            >
                              You
                            </span>
                          ) : null}
                        </td>
                        <td style={{ padding: "12px", color: "#374151" }}>{user.username}</td>
                        <td style={{ padding: "12px", color: "#374151" }}>{user.email}</td>
                        <td style={{ padding: "12px", color: "#374151" }}>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              borderRadius: "9999px",
                              padding: "2px 8px",
                              fontSize: "11px",
                              fontWeight: 700,
                              color: user.isDeleted ? "#9a3412" : "#065f46",
                              background: user.isDeleted ? "#fff7ed" : "#ecfdf5",
                              border: user.isDeleted ? "1px solid #fed7aa" : "1px solid #a7f3d0",
                            }}
                          >
                            {user.isDeleted ? "Deleted" : "Active"}
                          </span>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <select
                            value={user.role}
                            disabled={updatingUserId === user.id || user.isDeleted}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            style={{
                              border: "1px solid #d1d5db",
                              borderRadius: "8px",
                              padding: "6px 10px",
                              background: "#ffffff",
                              color: "#111827",
                            }}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "6px",
                              alignItems: "center",
                            }}
                          >
                            <button
                              type="button"
                              disabled={user.isCurrentUser || removingUserId === user.id || user.isDeleted}
                              onClick={() => handleRemoveUser(user)}
                              style={{
                                border: "1px solid #fca5a5",
                                background:
                                  user.isCurrentUser || user.isDeleted ? "#f9fafb" : "#fff7ed",
                                color: user.isCurrentUser || user.isDeleted ? "#9ca3af" : "#c2410c",
                                borderRadius: "9999px",
                                padding: "5px 10px",
                                cursor:
                                  user.isCurrentUser || user.isDeleted ? "not-allowed" : "pointer",
                                fontWeight: 600,
                                fontSize: "12px",
                                lineHeight: 1.2,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {removingUserId === user.id ? "Working..." : "Soft Delete"}
                            </button>
                            <button
                              type="button"
                              disabled={removingUserId === user.id || !user.isDeleted}
                              onClick={() => handleRestoreUser(user)}
                              style={{
                                border: "1px solid #86efac",
                                background: user.isDeleted ? "#ecfdf5" : "#f9fafb",
                                color: user.isDeleted ? "#047857" : "#9ca3af",
                                borderRadius: "9999px",
                                padding: "5px 10px",
                                cursor: user.isDeleted ? "pointer" : "not-allowed",
                                fontWeight: 600,
                                fontSize: "12px",
                                lineHeight: 1.2,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              disabled={user.isCurrentUser || removingUserId === user.id}
                              onClick={() => handleHardDeleteUser(user)}
                              style={{
                                border: "1px solid #fecaca",
                                background: user.isCurrentUser ? "#f9fafb" : "#fef2f2",
                                color: user.isCurrentUser ? "#9ca3af" : "#b91c1c",
                                borderRadius: "9999px",
                                padding: "5px 10px",
                                cursor: user.isCurrentUser ? "not-allowed" : "pointer",
                                fontWeight: 600,
                                fontSize: "12px",
                                lineHeight: 1.2,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Hard Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              style={{
                marginTop: "18px",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                overflowX: "auto",
                background: "#ffffff",
              }}
            >
              <div
                style={{
                  padding: "12px",
                  borderBottom: "1px solid #f3f4f6",
                  color: "#111827",
                  fontWeight: 700,
                }}
              >
                User Audit Log
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", color: "#374151", fontSize: "13px" }}>
                    <th style={{ textAlign: "left", padding: "12px" }}>Time</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Action</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>User</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Role</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Performed By</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td style={{ padding: "12px", color: "#6b7280" }} colSpan={5}>
                        No audit records yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "12px", color: "#374151" }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              borderRadius: "9999px",
                              padding: "2px 8px",
                              fontSize: "11px",
                              fontWeight: 700,
                              color: log.action === "removed" ? "#b91c1c" : "#065f46",
                              background: log.action === "removed" ? "#fef2f2" : "#ecfdf5",
                              border:
                                log.action === "removed"
                                  ? "1px solid #fecaca"
                                  : "1px solid #a7f3d0",
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: "12px", color: "#111827" }}>{log.targetUsername}</td>
                        <td style={{ padding: "12px", color: "#374151" }}>{log.targetRole || "-"}</td>
                        <td style={{ padding: "12px", color: "#374151" }}>
                          {log.performedByUsername || "System"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

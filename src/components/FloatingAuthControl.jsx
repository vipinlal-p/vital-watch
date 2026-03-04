import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layers } from "lucide-react";
import Toast from "./Toast";
import { apiUrl } from "/src/config/endpoints";

function SignedOutUserIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="#9CA3AF" />
      <path
        d="M4 18c0-2.761 2.239-5 5-5h6c2.761 0 5 2.239 5 5v1H4v-1z"
        fill="#9CA3AF"
      />
    </svg>
  );
}

export default function FloatingAuthControl({
  layerMenuValue = null,
  onLayerMenuChange,
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("user");
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const wrapperRef = useRef(null);
  const layersRef = useRef(null);

  const displayName = (() => {
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) return fullName;
    const base = String(username || "").split("@")[0] || "";
    const cleaned = base.replace(/[._-]+/g, " ").trim();
    if (!cleaned) return "User";
    return cleaned
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  })();

  const avatarLetter = isAuthenticated && displayName
    ? displayName.charAt(0).toUpperCase()
    : "";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(apiUrl("/api/profile"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setIsAuthenticated(true);
          setUsername(data.username || "");
          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
          setRole(data.role || "user");
        } else {
          localStorage.removeItem("token");
        }
      })
      .catch(() => localStorage.removeItem("token"));
  }, []);

  useEffect(() => {
    const onOutsideClick = (event) => {
      const clickedInsideAuth =
        wrapperRef.current && wrapperRef.current.contains(event.target);
      const clickedInsideLayers =
        layersRef.current && layersRef.current.contains(event.target);
      if (!clickedInsideAuth && !clickedInsideLayers) {
        setOpen(false);
        setLayersOpen(false);
        setError("");
      }
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(apiUrl("/api/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      localStorage.setItem("token", data.token);
      setIsAuthenticated(true);
      setUsername(data.username || "");
      setFirstName(data.firstName || "");
      setLastName(data.lastName || "");
      setRole(data.role || "user");
      setFormData({ username: "", password: "" });
      setError("");
      setOpen(false);
      setToast({ show: true, message: "Login successful!", type: "success" });
      setTimeout(() => setToast({ show: false, message: "", type: "" }), 2500);
    } catch (err) {
      console.error("Login error:", err);
      setError("Server error. Please try again.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setUsername("");
    setFirstName("");
    setLastName("");
    setRole("user");
    setShowPasswordForm(false);
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordError("");
    setOpen(false);
    setToast({ show: true, message: "Logged out successfully!", type: "success" });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 2500);
  };

  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError("Please fill all password fields");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirm password do not match");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setPasswordError("You are not logged in");
      return;
    }

    setPasswordUpdating(true);
    try {
      const res = await fetch(apiUrl("/api/change-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(passwordForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Unable to change password");
        return;
      }

      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPasswordForm(false);
      setToast({ show: true, message: "Password changed successfully", type: "success" });
      setTimeout(() => setToast({ show: false, message: "", type: "" }), 2500);
    } catch (err) {
      console.error("Change password error:", err);
      setPasswordError("Server error. Please try again.");
    } finally {
      setPasswordUpdating(false);
    }
  };

  return (
    <>
      <div
        ref={wrapperRef}
        style={{
          position: "fixed",
          top: "14px",
          right: "14px",
          zIndex: 5000,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <button
          onClick={() => navigate("/help")}
          title="Help"
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "9999px",
            border: "1px solid #d1d5db",
            background: "#ffffff",
            color: "#1f2937",
            fontSize: "22px",
            lineHeight: 1,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            display: "grid",
            placeItems: "center",
          }}
        >
          ?
        </button>

        <button
          onClick={() => {
            setOpen((v) => !v);
            setLayersOpen(false);
          }}
          title={isAuthenticated ? `Signed in as ${displayName}` : "Sign in"}
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "9999px",
            padding: "2px",
            border: "1px solid #d1d5db",
            background: "#ffffff",
            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "9999px",
              border: "2px solid #ffffff",
              background: "#fff",
              display: "grid",
              placeItems: "center",
              color: "#1f2937",
              fontWeight: 700,
              fontSize: "22px",
            }}
          >
            {isAuthenticated ? avatarLetter : <SignedOutUserIcon size={24} />}
          </div>
        </button>

        {open && (
          <div
            style={{
              position: "absolute",
              top: "62px",
              right: 0,
              width: "360px",
              background: "#e9edf3",
              borderRadius: "26px",
              boxShadow: "0 10px 22px rgba(0,0,0,0.28)",
              border: "1px solid rgba(0,0,0,0.08)",
              padding: "14px 14px 18px",
            }}
          >
            {isAuthenticated ? (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#111827",
                      maxWidth: "290px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {displayName}
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: "26px",
                      lineHeight: 1,
                      color: "#4b5563",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ display: "flex", justifyContent: "center", marginTop: "4px" }}>
                  <div
                    style={{
                      width: "94px",
                      height: "94px",
                      borderRadius: "9999px",
                      padding: "2px",
                      background:
                        "linear-gradient(135deg, #34a853 0%, #4285f4 55%, #ea4335 100%)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "9999px",
                        border: "2px solid #fff",
                        background: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "44px",
                        fontWeight: 700,
                        color: "#1f2937",
                      }}
                    >
                      {avatarLetter}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "8px",
                    textAlign: "center",
                    fontSize: "40px",
                    fontWeight: 700,
                    letterSpacing: "-0.8px",
                    color: "#111827",
                  }}
                >
                  Hi, {displayName}!
                </div>

                <div
                  style={{
                    marginTop: "14px",
                    borderRadius: "9999px",
                    overflow: "hidden",
                    border: "1px solid #d1d5db",
                    background: "#fff",
                  }}
                >
                  <button
                    onClick={() => {
                      setShowPasswordForm((prev) => !prev);
                      setPasswordError("");
                    }}
                    style={{
                      width: "100%",
                      border: "none",
                      background: showPasswordForm ? "#eef2ff" : "transparent",
                      padding: "12px 10px",
                      fontSize: "13px",
                      color: "#111827",
                      cursor: "pointer",
                      borderBottom: "1px solid #d1d5db",
                      fontWeight: 600,
                    }}
                  >
                    {showPasswordForm ? "Cancel Password Change" : "Change Password"}
                  </button>
                  {role === "admin" ? (
                    <button
                      onClick={() => {
                        navigate("/admin");
                        setOpen(false);
                      }}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "#eef2ff",
                        padding: "12px 10px",
                        fontSize: "13px",
                        color: "#1d4ed8",
                        cursor: "pointer",
                        borderBottom: "1px solid #d1d5db",
                        fontWeight: 700,
                      }}
                    >
                      Admin Panel
                    </button>
                  ) : null}
                  <button
                    onClick={handleLogout}
                    style={{
                      width: "100%",
                      border: "none",
                      background: "transparent",
                      padding: "12px 10px",
                      fontSize: "13px",
                      color: "#111827",
                      cursor: "pointer",
                    }}
                  >
                    Sign out
                  </button>
                </div>

                {showPasswordForm ? (
                  <form
                    onSubmit={handleChangePassword}
                    style={{
                      marginTop: "10px",
                      border: "1px solid #d1d5db",
                      borderRadius: "12px",
                      background: "#ffffff",
                      padding: "10px",
                      display: "grid",
                      gap: "8px",
                    }}
                  >
                    <input
                      type="password"
                      name="currentPassword"
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordInputChange}
                      placeholder="Current password"
                      style={{
                        width: "100%",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        padding: "8px 10px",
                        fontSize: "13px",
                      }}
                    />
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordInputChange}
                      placeholder="New password"
                      style={{
                        width: "100%",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        padding: "8px 10px",
                        fontSize: "13px",
                      }}
                    />
                    <input
                      type="password"
                      name="confirmPassword"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordInputChange}
                      placeholder="Confirm new password"
                      style={{
                        width: "100%",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        padding: "8px 10px",
                        fontSize: "13px",
                      }}
                    />
                    {passwordError ? (
                      <div style={{ color: "#b91c1c", fontSize: "12px", textAlign: "center" }}>
                        {passwordError}
                      </div>
                    ) : null}
                    <button
                      type="submit"
                      disabled={passwordUpdating}
                      style={{
                        width: "100%",
                        border: "none",
                        borderRadius: "8px",
                        padding: "9px 12px",
                        background: passwordUpdating ? "#9ca3af" : "#2563eb",
                        color: "#ffffff",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: passwordUpdating ? "not-allowed" : "pointer",
                      }}
                    >
                      {passwordUpdating ? "Updating..." : "Update Password"}
                    </button>
                  </form>
                ) : null}
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <div style={{ fontSize: "14px", color: "#111827" }}>Sign in</div>
                  <button
                    onClick={() => setOpen(false)}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: "26px",
                      lineHeight: 1,
                      color: "#4b5563",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 10px" }}>
                  <div
                    style={{
                      width: "94px",
                      height: "94px",
                      borderRadius: "9999px",
                      padding: "2px",
                      background:
                        "linear-gradient(135deg, #34a853 0%, #4285f4 55%, #ea4335 100%)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "9999px",
                        border: "2px solid #fff",
                        background: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "44px",
                        fontWeight: 700,
                        color: "#1f2937",
                      }}
                    >
                      <SignedOutUserIcon size={46} />
                    </div>
                  </div>
                </div>

                <form onSubmit={handleLogin} style={{ display: "grid", gap: "8px" }}>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, [e.target.name]: e.target.value }))
                    }
                    placeholder="Username"
                    style={{
                      width: "100%",
                      border: "1px solid #d1d5db",
                      borderRadius: "10px",
                      padding: "8px 10px",
                      fontSize: "14px",
                    }}
                  />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, [e.target.name]: e.target.value }))
                    }
                    placeholder="Password"
                    style={{
                      width: "100%",
                      border: "1px solid #d1d5db",
                      borderRadius: "10px",
                      padding: "8px 10px",
                      fontSize: "14px",
                    }}
                  />
                  {error ? (
                    <div style={{ color: "#b91c1c", fontSize: "12px", textAlign: "center" }}>
                      {error}
                    </div>
                  ) : null}
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      background: "#2563eb",
                      color: "#fff",
                      border: "none",
                      borderRadius: "10px",
                      padding: "9px 12px",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Sign in
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        ref={layersRef}
        style={{
          position: "fixed",
          right: "12px",
          bottom: "330px",
          zIndex: 5000,
        }}
      >
        <button
          className={layersOpen ? "custom-toggle-btn active" : "custom-toggle-btn"}
          onClick={() => {
            setLayersOpen((v) => !v);
            setOpen(false);
          }}
          title="Layers"
        >
          <Layers size={18} />
        </button>
        {layersOpen && (
          <div
            style={{
              position: "absolute",
              right: "46px",
              top: 0,
              width: "210px",
              background: "#fff",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.22)",
              border: "1px solid #e8eaed",
              padding: "8px",
              zIndex: 5100,
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {[
              ["vector", "Vector Layers"],
              ["raster", "Raster Layers"],
              ["disease-layer", "Disease Layer"],
              ["disease-heatmap", "Disease Heatmap"],
              ["disease-trends", "Disease Trends"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onLayerMenuChange?.(key);
                  setLayersOpen(false);
                }}
                style={{
                  border: "none",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: layerMenuValue === key ? "#1a73e8" : "#202124",
                  background: layerMenuValue === key ? "#e8f0fe" : "#fff",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <Toast message={toast.message} type={toast.type} show={toast.show} />
    </>
  );
}

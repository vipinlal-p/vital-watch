// src/components/Navbar.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import LoginDropdown from "/src/components/LoginDropdown";
import Toast from "/src/components/Toast"; // ✅ import Toast
import { apiUrl } from "/src/config/endpoints";

function Navbar() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "" }); // ✅ toast state
  const navigate = useNavigate();

  // ✅ Check token on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetch(apiUrl("/api/profile"), {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) {
            setIsAuthenticated(true);
            setUsername(data.username);
          } else {
            localStorage.removeItem("token");
          }
        })
        .catch(() => localStorage.removeItem("token"));
    }
  }, []);

  const handleLoginSuccess = (username) => {
    setIsAuthenticated(true);
    setUsername(username);

    // ✅ Show login success toast
    setToast({
      show: true,
      message: `Welcome back, ${username}!`,
      type: "success",
    });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setUsername("");
    navigate("/");

    // ✅ Show logout toast
    setToast({
      show: true,
      message: "Logged out successfully!",
      type: "success",
    });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  return (
    <>
      <nav
        className="text-[#202124] px-4"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "60px",
          zIndex: 99999,
          background: "transparent",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
          borderBottom: "none",
          display: "block",
        }}
      >
        <div className="w-full h-full flex justify-between items-center">
          {/* Left side - Logo + Title */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center text-xl font-bold">
              <img src="/logo.png" alt="Logo" className="h-10 w-12 mr-2" />
{/* Title + Subtitle stacked */}
<div className="flex flex-col leading-tight">
  <span className="text-xl font-bold">VitalWatch</span>
  <p className="text-xs italic text-[#202124]">
    Smart health monitoring made simple
  </p>
</div>

            </Link>
          </div>

          {/* Right side - Links + Login/Logout */}
          <div className="flex items-center gap-4">
            {/* ✅ Login / Logout */}
            {!isAuthenticated ? (
              <LoginDropdown onLoginSuccess={handleLoginSuccess} />
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg border border-red-700 hover:bg-red-700 transition"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ✅ Toast Popup */}
      <Toast message={toast.message} type={toast.type} show={toast.show} />
    </>
  );
}

export default Navbar;

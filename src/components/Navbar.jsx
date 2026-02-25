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
      <nav className="relative z-[5000] bg-gradient-to-r from-blue-700 via-blue-800 to-blue-900 text-white py-2 px-4">
        <div className="w-full flex justify-between items-center">
          {/* Left side - Logo + Title */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center text-xl font-bold">
              <img src="/logo.png" alt="Logo" className="h-10 w-12 mr-2" />
{/* Title + Subtitle stacked */}
<div className="flex flex-col leading-tight">
  <span className="text-xl font-bold">VitalWatch</span>
  <p className="text-xs italic text-gray-300">
    Smart health monitoring made simple
  </p>
</div>

            </Link>
          </div>

          {/* Right side - Links + Login/Logout */}
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-red-300">
              Home
            </Link>
            <Link to="/services" className="hover:text-red-300">
              Services
            </Link>
            <Link to="/contact" className="hover:text-red-300">
              Contact
            </Link>
            <Link to="/news" className="hover:text-red-300">
              News
            </Link>

            {/* ✅ Login / Logout */}
            {!isAuthenticated ? (
              <LoginDropdown onLoginSuccess={handleLoginSuccess} />
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm">👋 {username}</span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm bg-white text-gray-800 rounded-lg border border-gray-300 hover:bg-gray-100 transition"
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

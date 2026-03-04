// src/components/LoginDropdown.jsx
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RegisterModal from "./RegisterModal";
import Toast from "./Toast";
import { apiUrl } from "/src/config/endpoints";

export default function LoginDropdown({ onLoginSuccess }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
        setError("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(apiUrl("/api/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("token", data.token);
        if (onLoginSuccess) onLoginSuccess(data.username);
        setFormData({ username: "", password: "" });
        setError("");
        setOpen(false);

        // ✅ Show success toast
        setToast({ show: true, message: "Login successful!", type: "success" });
        setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Server error. Please try again.");
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Login Button */}
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg border border-blue-700 hover:bg-blue-700 transition"
      >
        Login
      </button>

      {/* Dropdown Form */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-72 rounded-2xl shadow-lg bg-white border border-gray-200 p-4 z-50"
          >
            <h3 className="text-lg font-semibold mb-3 text-gray-700">
              Welcome Back
            </h3>
            <form className="space-y-3" onSubmit={handleLogin}>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Username"
                className="w-full px-3 py-2 border rounded-xl focus:outline-none 
                           focus:ring-2 focus:ring-blue-400 text-gray-800 placeholder-gray-400"
              />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password"
                className="w-full px-3 py-2 border rounded-xl focus:outline-none 
                           focus:ring-2 focus:ring-blue-400 text-gray-800 placeholder-gray-400"
              />

              {error && <p className="text-red-600 text-sm text-center">{error}</p>}

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 transition"
              >
                Sign In
              </button>
            </form>

            <div className="text-sm text-center mt-3">
              <button
                onClick={() => {
                  setOpen(false);
                  setShowRegister(true);
                }}
                className="text-blue-600 hover:underline"
              >
                New user? Register here
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Register Modal */}
      <RegisterModal isOpen={showRegister} onClose={() => setShowRegister(false)} />

      {/* ✅ Toast Notification */}
      <Toast message={toast.message} type={toast.type} show={toast.show} />
    </div>
  );
}

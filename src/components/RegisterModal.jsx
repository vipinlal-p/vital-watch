// src/components/RegisterModal.jsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function RegisterModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    gender: "",
    dob: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [strength, setStrength] = useState(""); // password strength
  const [match, setMatch] = useState(false); // password match

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...formData, [name]: value };
    setFormData(updatedForm);

    if (name === "password") {
      evaluateStrength(value);
      setMatch(value === updatedForm.confirmPassword);
    }
    if (name === "confirmPassword") {
      setMatch(updatedForm.password === value);
    }
  };

  // ✅ Password strength evaluation
  const evaluateStrength = (password) => {
    const minLength = 8;
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[\W_]/.test(password);

    if (password.length < minLength) {
      setStrength("Too short");
    } else if (hasLower && hasUpper && hasNumber && hasSpecial) {
      setStrength("Strong");
    } else if ((hasLower || hasUpper) && hasNumber) {
      setStrength("Medium");
    } else {
      setStrength("Weak");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!match) {
      setError("Passwords do not match");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Registration successful! You can now log in.");
        setError("");
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          username: "",
          password: "",
          confirmPassword: "",
          gender: "",
          dob: "",
        });
        setStrength("");
        setMatch(false);
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError("Server error. Please try again.");
    }
  };

  const isFormValid =
    strength === "Strong" &&
    match &&
    formData.username &&
    formData.email &&
    formData.firstName &&
    formData.lastName &&
    formData.gender &&
    formData.dob;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="bg-white rounded-2xl shadow-xl p-6 w-96 transition-all duration-200"
          >
            <h3 className="text-xl font-semibold mb-4 text-gray-700">
              Register New Account
            </h3>
            <form className="space-y-3" onSubmit={handleRegister}>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="First name"
                  className="text-gray-800 w-1/2 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500"
                />
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Last name"
                  className="text-gray-800 w-1/2 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500"
                />
              </div>

              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email or mobile number"
                className="text-gray-800 w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500"
              />

              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Username"
                className="text-gray-800 w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500"
              />

              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                className="text-gray-800 w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500"
              />

              <div className="flex justify-around text-gray-700 font-medium">
                {["Male", "Female", "Other"].map((g) => (
                  <label key={g} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      checked={formData.gender === g}
                      onChange={handleChange}
                      className="accent-blue-500 w-4 h-4"
                    />
                    <span>{g}</span>
                  </label>
                ))}
              </div>


              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password"
                className="text-gray-800 w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500"
              />

              {/* ✅ Password strength meter */}
              {formData.password && (
                <p
                  className={`text-sm text-center font-medium transition-all duration-200 ${strength === "Strong"
                      ? "text-green-600"
                      : strength === "Medium"
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                >
                  {strength}
                </p>
              )}

              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm Password"
                className="text-gray-800 w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500"
              />

              {/* ✅ Real-time password match check */}
              {formData.confirmPassword && (
                <p
                  className={`text-sm text-center font-medium transition-all duration-200 ${match ? "text-green-600" : "text-red-600"
                    }`}
                >
                  {match ? "Passwords match" : "Passwords do not match"}
                </p>
              )}

              {error && (
                <p className="text-red-600 text-sm text-center">{error}</p>
              )}
              {success && (
                <p className="text-green-600 text-sm text-center">{success}</p>
              )}

              <button
                type="submit"
                disabled={!isFormValid}
                className={`w-full py-2 rounded-xl font-medium shadow-md transition-all duration-200 ${isFormValid
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
              >
                Register
              </button>
            </form>
            <div className="text-sm text-center mt-3">
              <button
                onClick={onClose}
                className="text-blue-600 hover:underline transition-all duration-200"
              >
                Go back
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

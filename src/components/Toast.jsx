// src/components/Toast.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Toast({ message, show }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 0.3 }}
          className="fixed top-12 left-1/2 transform -translate-x-1/2 
                     px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium z-50
                     bg-blue-700"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

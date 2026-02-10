// src/components/CopyrightWatermark.jsx
import React from "react";

function CopyrightWatermark() {
  return (
    <div
      className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none select-none"
      style={{
        opacity: 1, // ✅ more watermark-like transparency
      }}
    >
      <p className="text-xs text-black text-center tracking-wide">
        © 2025 Earth Observation Group · Amrita-NRML
      </p>
    </div>
  );
}

export default CopyrightWatermark;

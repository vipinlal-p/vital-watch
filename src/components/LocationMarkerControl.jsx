// src/components/LocationMarkerControl.jsx
import React, { useState, useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/map-controls.css";

// ✅ Fix default Leaflet marker missing icon in React builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function LocationMarkerControl() {
  const map = useMap();
  const [enabled, setEnabled] = useState(false);
  const markerRef = useRef(null);
  const toggleRef = useRef(null);

  // prevent toggle clicks/scrolls from reaching the map
  useEffect(() => {
    if (toggleRef.current) {
      L.DomEvent.disableClickPropagation(toggleRef.current);
      L.DomEvent.disableScrollPropagation(toggleRef.current);
    }
  }, []);

  // helper: inject copy button handler
  useEffect(() => {
    const handleCopyClick = (e) => {
      if (e.target && e.target.classList.contains("copy-coords-btn")) {
        const coords = e.target.getAttribute("data-coords");
        navigator.clipboard.writeText(coords).then(() => {
          e.target.textContent = "Copied!";
          setTimeout(() => {
            e.target.textContent = "📋 Copy";
          }, 1500);
        });
      }
    };

    document.addEventListener("click", handleCopyClick);
    return () => {
      document.removeEventListener("click", handleCopyClick);
    };
  }, []);

  // handle pin placement
  useEffect(() => {
    if (!map) return;

    const handleClick = async (e) => {
      if (!enabled) return;

      const { lat, lng } = e.latlng;

      // ✅ remove old marker if exists
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }

      // ✅ use Leaflet’s default marker
      const marker = L.marker([lat, lng], { icon: new L.Icon.Default() }).addTo(
        map
      );
      markerRef.current = marker;

      marker
        .bindPopup(
          `<b>Loading address...</b><br/>${lat.toFixed(6)}, ${lng.toFixed(6)}`
        )
        .openPopup();

      // fetch reverse geocoding
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
        );
        const data = await res.json();

        let address = "Unknown location";
        let shortAddress = "";

        if (data) {
          address = data.display_name || "Unknown location";

          shortAddress =
            data.name ||
            data.address?.suburb ||
            data.address?.village ||
            data.address?.town ||
            data.address?.city ||
            "Unknown place";

          const postcode = data.address?.postcode
            ? `, ${data.address.postcode}`
            : "";
          shortAddress = `${shortAddress}${postcode}`;
        }

        const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

        marker.setPopupContent(`
          <div style="width: 250px">
            <h2 style="font-weight: 600; margin-bottom: 4px;">${shortAddress}</h2>
            <p style="font-size: 0.85rem; color: #555; margin-bottom: 6px;">${address}</p>
            <div style="display:flex; align-items:center; gap:6px;">
              <a 
                href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16"
                target="_blank"
                rel="noopener noreferrer"
                style="color: #2563eb; font-weight: 500; text-decoration: underline;"
              >
                ${coords}
              </a>
              <button 
                class="copy-coords-btn"
                data-coords="${coords}"
                style="background:#f1f1f1; border:1px solid #ccc; border-radius:4px; padding:2px 6px; font-size:0.8rem; cursor:pointer;"
              >
                📋 Copy
              </button>
            </div>
            <small style="color:#999; display:block; margin-top:4px;">
              (Copy and Paste the coordinates in search bar to get directions)
            </small>
          </div>
        `);
      } catch (err) {
        marker.setPopupContent(
          `<b>Pin</b><br/>${lat.toFixed(6)}, ${lng.toFixed(
            6
          )}<br/><i>Address lookup failed</i>`
        );
      }
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [map, enabled]);

  // ✅ remove marker when toggle is switched OFF
  useEffect(() => {
    if (!enabled && markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  }, [enabled, map]);

  return (
    <div
      className="custom-layer-control"
      style={{ top: "340px" }}
      ref={toggleRef}
    >
      <button
        className={`custom-toggle-btn ${enabled ? "active" : ""}`}
        title="Drop Pin"
        onClick={() => setEnabled((p) => !p)}
      >
        {/* ✅ SVG for the button icon (Google-style pin) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill={enabled ? "#1a73e8" : "currentColor"}
        >
          <path
            d="M12 2C8.1 2 5 5.1 5 9c0 5.3 7 13 7 13s7-7.7 7-13c0-3.9-3.1-7-7-7zm0 9.5
                   c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5S13.4 11.5 12 11.5z"
          />
        </svg>
      </button>
    </div>
  );
}

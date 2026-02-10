// src/components/NearbyPlacesControl.jsx
import React, { useState, useRef, useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { Locate, Shield, Hospital, Pill, X, ChevronDown } from "lucide-react";
import "../styles/nearby-places.css";

// ✅ Fix default Leaflet marker missing icon in React builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function NearbyPlacesControl({ userLocation, destination }) {
  const map = useMap();
  const [showMenu, setShowMenu] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [locationChoice, setLocationChoice] = useState("auto"); // auto / user / destination
  const [showDropdown, setShowDropdown] = useState(false);
  const poiMarkersRef = useRef([]);
  const bufferCircleRef = useRef(null);

  // -----------------------------
  // Custom Icons
  // -----------------------------
  const hospitalIcon = L.divIcon({
    className: "custom-poi-icon hospital-icon",
    html: "H",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  const policeIcon = L.divIcon({
    className: "custom-poi-icon police-icon",
    html: "⭐",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  const pharmacyIcon = L.divIcon({
    className: "custom-poi-icon pharmacy-icon",
    html: "💊",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  // -----------------------------
  // Copy coords handler (global)
  // -----------------------------
  useEffect(() => {
    const handleCopyClick = (e) => {
      if (e.target && e.target.classList.contains("copy-coords-btn")) {
        const coords = e.target.getAttribute("data-coords");
        if (!coords) return;
        navigator.clipboard.writeText(coords).then(() => {
          const original = e.target.textContent;
          e.target.textContent = "Copied!";
          setTimeout(() => {
            e.target.textContent = original || "📋 Copy";
          }, 1500);
        });
      }
    };
    document.addEventListener("click", handleCopyClick);
    return () => {
      document.removeEventListener("click", handleCopyClick);
    };
  }, []);

  // -----------------------------
  // Clear markers + buffer
  // -----------------------------
  const clearPOIs = () => {
    poiMarkersRef.current.forEach((m) => {
      if (map.hasLayer(m)) map.removeLayer(m);
    });
    poiMarkersRef.current = [];
    if (bufferCircleRef.current && map.hasLayer(bufferCircleRef.current)) {
      map.removeLayer(bufferCircleRef.current);
      bufferCircleRef.current = null;
    }
    setHasResults(false);
    setShowMenu(false);
  };

  // -----------------------------
  // Add marker with popup (includes copy + instruction)
  // -----------------------------
  const addMarkerWithPopup = async (lat, lon, name, category) => {
    let icon = new L.Icon.Default();
    if (category === "hospital") icon = hospitalIcon;
    if (category === "police") icon = policeIcon;
    if (category === "pharmacy") icon = pharmacyIcon;

    const marker = L.marker([lat, lon], { icon }).addTo(map);

    // initial placeholder
    marker
      .bindPopup(
        `<b>${name || "Loading..."}</b><br/>${lat.toFixed(6)}, ${lon.toFixed(
          6
        )}`
      )
      .openPopup();

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
      );
      const data = await res.json();

      let address = data?.display_name || "Unknown location";
      let shortAddress =
        data?.name ||
        data?.address?.suburb ||
        data?.address?.village ||
        data?.address?.town ||
        data?.address?.city ||
        name ||
        "Unknown place";

      const postcode = data?.address?.postcode
        ? `, ${data.address.postcode}`
        : "";
      shortAddress = `${shortAddress}${postcode}`;

      const coords = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

      marker.setPopupContent(`
        <div style="width: 260px; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;">
          <h3 style="font-size: 1rem; margin:0 0 4px 0; font-weight:600;">${shortAddress}</h3>
          <p style="margin:0 0 8px 0; font-size:0.85rem; color:#555;">${address}</p>
          <div style="display:flex; gap:8px; align-items:center; justify-content:space-between;">
            <a
              href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=16"
              target="_blank"
              rel="noopener noreferrer"
              style="text-decoration:underline; color:#2563eb; font-size:0.9rem;"
            >
              ${coords}
            </a>
            <button
              class="copy-coords-btn"
              data-coords="${coords}"
              style="background:#f3f4f6; border:1px solid #d1d5db; border-radius:6px; padding:4px 8px; font-size:0.85rem; cursor:pointer;"
            >
              📋 Copy
            </button>
          </div>
          <small style="display:block; margin-top:6px; color:#888; font-size:0.75rem;">
            Copy the coordinates and paste them into the search bar to get directions.
          </small>
        </div>
      `);
    } catch (err) {
      const coords = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      marker.setPopupContent(`
        <div style="width: 220px;">
          <b>${name || "Place"}</b><br/>${coords}
          <div style="margin-top:6px;">
            <button
              class="copy-coords-btn"
              data-coords="${coords}"
              style="background:#f3f4f6; border:1px solid #d1d5db; border-radius:6px; padding:4px 8px; font-size:0.85rem; cursor:pointer;"
            >
              📋 Copy
            </button>
          </div>
          <small style="display:block; margin-top:6px; color:#888; font-size:0.75rem;">
            Copy the coordinates and paste them into the search bar to get directions.
          </small>
        </div>
      `);
    }

    poiMarkersRef.current.push(marker);
    return marker;
  };

  // -----------------------------
  // Fetch POIs
  // -----------------------------
  const fetchPOIs = async (category, base) => {
    try {
      if (!base) return;
      const [lat, lon] = base;
      const radius = 5000;
      let query = "";
      if (category === "hospital")
        query = `node["amenity"="hospital"](around:${radius},${lat},${lon});`;
      if (category === "police")
        query = `node["amenity"="police"](around:${radius},${lat},${lon});`;
      if (category === "pharmacy")
        query = `node["amenity"="pharmacy"](around:${radius},${lat},${lon});`;

      const url = `https://overpass-api.de/api/interpreter?data=[out:json];(${query});out;`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Overpass API error ${res.status}`);
      const data = await res.json();

      clearPOIs();

      const circle = L.circle([lat, lon], {
        radius,
        color: "#2563eb",
        fillColor: "#2563eb",
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map);
      bufferCircleRef.current = circle;

      if (!data.elements || data.elements.length === 0) return;

      const newMarkers = await Promise.all(
        data.elements.map((el) =>
          addMarkerWithPopup(el.lat, el.lon, el.tags?.name, category)
        )
      );
      setHasResults(true);

      if (newMarkers.length > 0) {
        const group = L.featureGroup([...newMarkers, circle]);
        map.fitBounds(group.getBounds(), { padding: [40, 40] });
      }
    } catch (err) {
      console.error("NearbyPlacesControl error:", err);
    }
  };

  // -----------------------------
  // Handle category click
  // -----------------------------
  const handleCategoryClick = (category) => {
    let base = null;
    if (locationChoice === "user" && userLocation) base = userLocation;
    else if (locationChoice === "destination" && destination)
      base = destination;
    else base = destination || userLocation;
    if (!base) return;
    setShowMenu(false);
    fetchPOIs(category, base);
  };

  // -----------------------------
  // Render modern dropdown
  // -----------------------------
  const renderLocationDropdown = () => {
    if (!(userLocation && destination)) return null;
    const labelMap = {
      auto: "Auto (prefer searched)",
      user: "My Location",
      destination: "Searched Location",
    };
    return (
      <div className="dropdown-container">
        <button
          type="button"
          className="dropdown-btn"
          onClick={() => setShowDropdown((s) => !s)}
        >
          {labelMap[locationChoice]}
          <ChevronDown size={16} style={{ marginLeft: "6px" }} />
        </button>
        {showDropdown && (
          <div className="dropdown-menu">
            {Object.entries(labelMap).map(([value, label]) => (
              <div
                key={value}
                className={`dropdown-item ${
                  locationChoice === value ? "active" : ""
                }`}
                onClick={() => {
                  setLocationChoice(value);
                  setShowDropdown(false);
                }}
              >
                {label}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="poi-wrapper">
      <button
        type="button"
        className={`map-poi-btn ${hasResults ? "active" : ""}`}
        title={hasResults ? "Clear Nearby" : "Find Nearby"}
        onClick={() => {
          hasResults ? clearPOIs() : setShowMenu((s) => !s);
        }}
      >
        {hasResults ? <X size={18} /> : <Locate size={18} />}
      </button>

      {!hasResults && showMenu && (
        <div className="poi-menu">
          {renderLocationDropdown()}
          <button onClick={() => handleCategoryClick("hospital")}>
            <Hospital size={16} /> Hospitals
          </button>
          <button onClick={() => handleCategoryClick("police")}>
            <Shield size={16} /> Police
          </button>
          <button onClick={() => handleCategoryClick("pharmacy")}>
            <Pill size={16} /> Medical Shops
          </button>
        </div>
      )}
    </div>
  );
}

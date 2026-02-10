// src/components/MapLayersToggle.jsx
import React, { useState, useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/map-controls.css";

export const baseLayers = {
  osm: {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  satellite: {
    name: "Satellite",
    url: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg",
    attribution: "Sentinel-2 cloudless © ESA & EOX",
  },
  topo: {
    name: "Topographic",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      "Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)",
  },
  dark: {
    name: "Dark Mode",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; Carto, OpenStreetMap contributors",
  },
};

function MapLayersToggle({ activeBase, setActiveBase }) {
  const [open, setOpen] = useState(false);
  const map = useMap();
  const controlRef = useRef(null);

  // ✅ Ensure base layer is always on map
  useEffect(() => {
    if (!map) return;

    // remove any existing TileLayer
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    // add the currently selected base layer
    const { url, attribution } = baseLayers[activeBase];
    L.tileLayer(url, { attribution }).addTo(map);
  }, [map, activeBase]);

  // ✅ Block clicks & scrolls from leaking through
  useEffect(() => {
    if (controlRef.current) {
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  return (
    <div className="custom-layer-control" ref={controlRef}>
      {/* ✅ Custom toggle button with tooltip */}
      <button
        className="custom-toggle-btn"
        title="Map Layers"
        onClick={() => setOpen(!open)}
      >
        {/* inline SVG icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          fill="none"
          stroke="#333"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <polygon points="12 2 19 7 12 12 5 7 12 2" />
          <polyline points="19 17 12 22 5 17" />
          <polyline points="19 12 12 17 5 12" />
        </svg>
      </button>

      {/* ✅ Custom dropdown */}
      {open && (
        <div className="custom-dropdown">
          {Object.entries(baseLayers).map(([key, layer]) => (
            <label key={key} className="custom-option">
              <input
                type="radio"
                name="baseLayer"
                checked={activeBase === key}
                onChange={() => setActiveBase(key)}
              />
              {layer.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default MapLayersToggle;

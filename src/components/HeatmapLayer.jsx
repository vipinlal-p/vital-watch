// src/components/HeatmapLayer.jsx
import { useEffect, useState, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import { GEOSERVER_OWS_URL } from "/src/config/endpoints";
import "../styles/map-controls.css";
import "../styles/heatmap-layer.css";

function HeatmapLayer() {
  const map = useMap();
  const [enabled, setEnabled] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [year, setYear] = useState("All");
  const [years, setYears] = useState(["All"]);
  const [crimeType, setCrimeType] = useState("All");
  const [crimeTypes, setCrimeTypes] = useState(["All"]);
  const heatLayerRef = useRef(null);
  const controlRef = useRef(null);
  const legendRef = useRef(null);

  // ✅ Prevent clicks on control from bubbling to map
  useEffect(() => {
    if (controlRef.current) {
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  // 🔹 Fetch distinct years + crime types from WFS
  useEffect(() => {
    const url =
      `${GEOSERVER_OWS_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=crime_map_app:crime_records_all&outputFormat=application/json&propertyName=year,crime_type`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const uniqueYears = Array.from(
          new Set(data.features.map((f) => f.properties.year).filter((v) => v))
        ).sort((a, b) => a - b);

        const uniqueTypes = Array.from(
          new Set(
            data.features
              .map((f) => f.properties.crime_type)
              .filter((v) => v && v.trim() !== "")
          )
        ).sort();

        setYears(["All", ...uniqueYears]);
        setCrimeTypes(["All", ...uniqueTypes]);
      })
      .catch((err) => console.error("Error fetching filter options:", err));
  }, []);

  // 🔹 Fetch & render heatmap
  useEffect(() => {
    if (!map) return;

    try {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    } catch {}
    try {
      if (legendRef.current) {
        map.removeControl(legendRef.current);
        legendRef.current = null;
      }
    } catch {}

    if (!enabled) return;

    let url =
      `${GEOSERVER_OWS_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=crime_map_app:crime_records_all&outputFormat=application/json`;

    const filters = [];
    if (year !== "All") filters.push(`year=${year}`);
    if (crimeType !== "All") filters.push(`crime_type='${crimeType}'`);

    if (filters.length > 0) {
      url += `&CQL_FILTER=${filters.join(" AND ")}`;
    }

    let isCancelled = false;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (isCancelled) return;

        const heatPoints = data.features
          .filter((f) => f.geometry)
          .map((f) => {
            const [lon, lat] = f.geometry.coordinates;
            return [lat, lon, f.properties.crime_count];
          });

        const gradient = {
          0.1: "#4575b4",
          0.3: "#91bfdb",
          0.5: "#ffffbf",
          0.7: "#fdae61",
          1.0: "#d73027",
        };

        const heatLayer = L.heatLayer(heatPoints, {
          radius: 25,
          blur: 15,
          maxZoom: 17,
          minOpacity: 0.4,
          gradient,
        }).addTo(map);

        heatLayerRef.current = heatLayer;

        // ✅ Legend
        const legend = L.control({ position: "bottomleft" });
        legend.onAdd = function () {
          const div = L.DomUtil.create("div", "info legend");
          div.innerHTML = `
            <div style="font-weight: bold;font-size: 13px;margin-bottom: 4px;font-family: Arial, sans-serif;">
              Crime Intensity (${year}, ${crimeType})
            </div>
            <div style="width: 140px;height: 14px;background: linear-gradient(to right, 
              ${gradient[0.1]}, 
              ${gradient[0.3]}, 
              ${gradient[0.5]}, 
              ${gradient[0.7]}, 
              ${gradient[1.0]});border: 1px solid #999;border-radius: 3px;margin-bottom: 4px;">
            </div>
            <div style="display: flex;justify-content: space-between;font-size: 11px;font-family: Arial, sans-serif;">
              <span>Low</span>
              <span>High</span>
            </div>
          `;
          return div;
        };
        legend.addTo(map);
        legendRef.current = legend;
      });

    return () => {
      isCancelled = true;
      try {
        if (heatLayerRef.current) {
          map.removeLayer(heatLayerRef.current);
          heatLayerRef.current = null;
        }
      } catch {}
      try {
        if (legendRef.current) {
          map.removeControl(legendRef.current);
          legendRef.current = null;
        }
      } catch {}
    };
  }, [map, enabled, year, crimeType]);

  return (
    <div
      className="custom-layer-control"
      style={{ top: "390px" }}
      ref={controlRef}
    >
      {/* Toggle dropdown button */}
      <button
        className="custom-toggle-btn"
        title="Heatmap Options"
        onClick={() => setDropdownOpen((p) => !p)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill={enabled ? "#FF5722" : "currentColor"}
        >
          <path d="M12 2C10.5 4 9 7 9 9.5c0 2.2 1.8 4 4 4s4-1.8 4-4c0-2.5-1.5-5.5-3-7.5-1.5 2-3 5-3 7.5z" />
          <path d="M12 13c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5c0-2.8-2.2-5-5-5z" />
        </svg>
      </button>

      {/* Dropdown with filters */}
      {dropdownOpen && (
        <div className="custom-dropdown">
          <label className="custom-option">
            <input
              type="checkbox"
              checked={enabled}
              onChange={() => setEnabled((p) => !p)}
            />
            Enable Heatmap
          </label>

          <label className="custom-option">Year:</label>
          <select
            className="custom-option"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            disabled={!enabled}
          >
            {years.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          <label className="custom-option">Crime Type:</label>
          <select
            className="custom-option"
            value={crimeType}
            onChange={(e) => setCrimeType(e.target.value)}
            disabled={!enabled}
          >
            {crimeTypes.map((ct) => (
              <option key={ct} value={ct}>
                {ct}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export default HeatmapLayer;

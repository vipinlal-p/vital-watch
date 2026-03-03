// src/components/HeatmapLayer.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import "../styles/map-controls.css";
import "../styles/heatmap-layer.css";
import "../styles/add-crime-data.css";
import diseaseCsvRaw from "/disease_data/tvm_dummy_data.csv?raw";

const parseCsvRow = (line) => {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((v) => v.trim());
};

const parseDiseaseCsv = (raw) => {
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvRow(lines[0]);
  const idx = (key) => headers.findIndex((h) => h === key);

  return lines.slice(1).map((line) => {
    const cols = parseCsvRow(line);
    const get = (key) => {
      const i = idx(key);
      return i >= 0 ? cols[i] : "";
    };
    return {
      ward_code: get("ward_code"),
      latitude: Number(get("latitude")),
      longitude: Number(get("longitude")),
      year: Number(get("year")),
      disease: get("disease"),
      cases_confirmed: Number(get("cases_confirmed")) || 0,
      cases_probable: Number(get("cases_probable")) || 0,
    };
  });
};

function HeatmapLayer({
  hideToggle = false,
  externallyOpen,
  containerStyle,
}) {
  const map = useMap();
  const [enabled, setEnabled] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [year, setYear] = useState("All");
  const [diseaseType, setDiseaseType] = useState("All");
  const heatLayerRef = useRef(null);
  const controlRef = useRef(null);
  const legendRef = useRef(null);
  const rows = useMemo(() => parseDiseaseCsv(diseaseCsvRaw), []);
  const years = useMemo(() => {
    const unique = Array.from(
      new Set(rows.map((r) => r.year).filter((v) => Number.isFinite(v)))
    ).sort((a, b) => a - b);
    return ["All", ...unique];
  }, [rows]);
  const diseaseTypes = useMemo(() => {
    const unique = Array.from(
      new Set(rows.map((r) => r.disease).filter((v) => v && v.trim() !== ""))
    ).sort();
    return ["All", ...unique];
  }, [rows]);
  const visible =
    typeof externallyOpen === "boolean" ? externallyOpen : dropdownOpen;

  // ✅ Prevent clicks on control from bubbling to map
  useEffect(() => {
    if (controlRef.current) {
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  // 🔹 Build & render disease heatmap from local CSV
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

    const filtered = rows.filter((r) => {
      if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) return false;
      if (year !== "All" && r.year !== Number(year)) return false;
      if (diseaseType !== "All" && r.disease !== diseaseType) return false;
      return true;
    });

    const aggregated = new Map();
    filtered.forEach((r) => {
      const key = `${r.ward_code}|${r.latitude}|${r.longitude}`;
      const weight = (r.cases_confirmed || 0) + (r.cases_probable || 0);
      const current = aggregated.get(key) || {
        lat: r.latitude,
        lon: r.longitude,
        weight: 0,
      };
      current.weight += weight;
      aggregated.set(key, current);
    });

    const heatPoints = [...aggregated.values()]
      .filter((p) => p.weight > 0)
      .map((p) => [p.lat, p.lon, p.weight]);

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

    const legend = L.control({ position: "bottomleft" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "info legend");
      div.innerHTML = `
        <div style="font-weight: bold;font-size: 13px;margin-bottom: 4px;font-family: Arial, sans-serif;">
          Disease Intensity (${year}, ${diseaseType})
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

    return () => {
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
  }, [map, enabled, year, diseaseType, rows]);

  return (
    <div
      className="add-crime-control"
      style={containerStyle || { top: "168px", left: "12px", width: "270px" }}
      ref={controlRef}
    >
      {!hideToggle && (
        <button
          className="add-crime-btn"
          title="Heatmap Options"
          onClick={() => setDropdownOpen((p) => !p)}
        >
          Disease Heatmap
        </button>
      )}

      {visible && (
        <div className="add-crime-form raster-panel">
          <label className="custom-option">
            <input
              type="checkbox"
              checked={enabled}
              onChange={() => setEnabled((p) => !p)}
            />
            Enable Heatmap
          </label>

          <label className="raster-meta">Year</label>
          <select
            className="raster-search"
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

          <label className="raster-meta">Disease</label>
          <select
            className="raster-search"
            value={diseaseType}
            onChange={(e) => setDiseaseType(e.target.value)}
            disabled={!enabled}
          >
            {diseaseTypes.map((ct) => (
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

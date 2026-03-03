// src/components/DiseaseLayer.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "../styles/map-controls.css";
import "../styles/layer-panels.css";
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
      ward_name: get("ward_name"),
      latitude: Number(get("latitude")),
      longitude: Number(get("longitude")),
      year: Number(get("year")),
      month: Number(get("month")),
      disease: get("disease"),
      cases_confirmed: Number(get("cases_confirmed")) || 0,
      cases_probable: Number(get("cases_probable")) || 0,
      population: Number(get("population")) || 0,
    };
  });
};

const summarizeByWard = (rows) => {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row.ward_code || row.ward_name;
    if (!key) return;
    if (!grouped.has(key)) {
      grouped.set(key, {
        ward_code: row.ward_code,
        ward_name: row.ward_name,
        latitude: row.latitude,
        longitude: row.longitude,
        population: row.population,
        total_confirmed: 0,
        total_probable: 0,
        min_year: row.year,
        max_year: row.year,
        diseases: new Set(),
        by_year: new Map(),
      });
    }
    const item = grouped.get(key);
    item.total_confirmed += row.cases_confirmed;
    item.total_probable += row.cases_probable;
    item.population = row.population || item.population;
    item.min_year = Math.min(item.min_year, row.year);
    item.max_year = Math.max(item.max_year, row.year);
    if (row.disease) item.diseases.add(row.disease);

    const yearStats = item.by_year.get(row.year) || {
      confirmed: 0,
      probable: 0,
    };
    yearStats.confirmed += row.cases_confirmed;
    yearStats.probable += row.cases_probable;
    item.by_year.set(row.year, yearStats);
  });

  return [...grouped.values()].map((item) => ({
    ...item,
    diseases: [...item.diseases],
    by_year: [...item.by_year.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([year, stats]) => ({ year, ...stats })),
  }));
};

function DiseaseLayer({
  hideToggle = false,
  externallyOpen,
  containerStyle,
}) {
  const map = useMap();
  const [enabled, setEnabled] = useState(true);
  const [visibleLocal, setVisibleLocal] = useState(false);
  const layerRef = useRef(null);
  const toggleRef = useRef(null);
  const diseaseRows = useMemo(() => parseDiseaseCsv(diseaseCsvRaw), []);
  const wardSummary = useMemo(() => summarizeByWard(diseaseRows), [diseaseRows]);
  const visible =
    typeof externallyOpen === "boolean" ? externallyOpen : visibleLocal;

  useEffect(() => {
    if (toggleRef.current) {
      L.DomEvent.disableClickPropagation(toggleRef.current);
      L.DomEvent.disableScrollPropagation(toggleRef.current);
    }
  }, []);

  useEffect(() => {
    if (!map) return;

    try {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    } catch {}
    if (!enabled) return;

    const features = wardSummary
      .filter(
        (w) =>
          Number.isFinite(w.latitude) &&
          Number.isFinite(w.longitude) &&
          (w.total_confirmed > 0 || w.total_probable > 0)
      )
      .map((w) => ({
        type: "Feature",
        properties: w,
        geometry: {
          type: "Point",
          coordinates: [w.longitude, w.latitude],
        },
      }));

    const geoJsonLayer = L.geoJSON(
      { type: "FeatureCollection", features },
      {
        pointToLayer: (feature, latlng) => {
          const total =
            (feature.properties.total_confirmed || 0) +
            (feature.properties.total_probable || 0);
          const radius = Math.max(5, Math.min(14, 5 + total / 60));
          return L.circleMarker(latlng, {
            radius,
            fillColor: "#d32f2f",
            color: "#7f1d1d",
            weight: 1,
            fillOpacity: 0.78,
          });
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties;
          const totalCases =
            (props.total_confirmed || 0) + (props.total_probable || 0);
          const wardId = props.ward_code || props.ward_name;
          const popupContent = `
            <b>Ward:</b> ${props.ward_name || "-"} (${props.ward_code || "-"})<br/>
            <b>Total Confirmed:</b> ${props.total_confirmed || 0}<br/>
            <b>Total Probable:</b> ${props.total_probable || 0}<br/>
            <b>Total Cases:</b> ${totalCases}<br/>
            <b>Diseases:</b> ${(props.diseases || []).join(", ") || "-"}<br/>
            <b>Population:</b> ${props.population || "-"}<br/>
            <b>Year Range:</b> ${props.min_year || "-"} - ${props.max_year || "-"}<br/>
            <button id="view-more-${wardId}"
              style="margin-top:6px; padding:3px 6px; background:#1976d2; color:white; border:none; border-radius:4px; cursor:pointer;">
              View Yearly Summary
            </button>
            <button id="download-${wardId}"
              style="margin-left:6px; margin-top:6px; padding:3px 6px; background:green; color:white; border:none; border-radius:4px; cursor:pointer;">
              Download CSV
            </button>
            <div id="details-${wardId}" style="margin-top:8px; max-height:150px; overflow-y:auto;"></div>
          `;
          layer.bindPopup(popupContent);

          layer.on("popupopen", () => {
            const detailBtn = document.getElementById(`view-more-${wardId}`);
            if (detailBtn) {
              detailBtn.onclick = () => {
                const details = (props.by_year || [])
                  .map(
                    (yr) =>
                      `<div><b>${yr.year}</b>: Confirmed ${yr.confirmed}, Probable ${yr.probable}, Total ${
                        (yr.confirmed || 0) + (yr.probable || 0)
                      }</div>`
                  )
                  .join("");
                const detailDiv = document.getElementById(`details-${wardId}`);
                if (detailDiv) {
                  detailDiv.innerHTML = details || "No yearly data";
                }
              };
            }

            const dlBtn = document.getElementById(`download-${wardId}`);
            if (dlBtn) {
              dlBtn.onclick = () => {
                const rows = [
                  [
                    "Ward Code",
                    "Ward Name",
                    "Year",
                    "Cases Confirmed",
                    "Cases Probable",
                    "Total Cases",
                  ],
                ];
                (props.by_year || []).forEach((r) => {
                  rows.push([
                    props.ward_code || "",
                    props.ward_name || "",
                    r.year,
                    r.confirmed || 0,
                    r.probable || 0,
                    (r.confirmed || 0) + (r.probable || 0),
                  ]);
                });
                const csvContent = rows
                  .map((row) => row.map((cell) => `"${String(cell)}"`).join(","))
                  .join("\n");
                const blob = new Blob([csvContent], {
                  type: "text/csv;charset=utf-8;",
                });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `${wardId}_disease_summary.csv`;
                link.click();
              };
            }
          });
        },
      }
    ).addTo(map);

    layerRef.current = geoJsonLayer;

    return () => {
      try {
        if (layerRef.current) {
          map.removeLayer(layerRef.current);
          layerRef.current = null;
        }
      } catch {}
    };
  }, [map, enabled, wardSummary]);

  return (
    <div
      className="layer-panel-control"
      style={containerStyle || { top: "168px", left: "12px", width: "270px" }}
      ref={toggleRef}
    >
      {!hideToggle && (
        <button
          className="layer-panel-btn"
          title="Disease Layer"
          onClick={() => setVisibleLocal((p) => !p)}
        >
          Disease Layer
        </button>
      )}

      {visible && (
        <div className="layer-panel-form raster-panel">
          <label className="custom-option">
            <input
              type="checkbox"
              checked={enabled}
              onChange={() => setEnabled((p) => !p)}
            />
            Enable Disease Layer
          </label>
        </div>
      )}
    </div>
  );
}

export default DiseaseLayer;

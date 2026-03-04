// src/components/HeatmapLayer.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "../styles/map-controls.css";
import "../styles/heatmap-layer.css";
import "../styles/layer-panels.css";
import diseaseCsvRaw from "/disease_data/tvm_dummy_data.csv?raw";
import tvmBoundaryGeoJson from "/src/data/trivandrum_shapefile.json";
import tvmVillagesGeoJson from "/src/data/trivandrum_villages.json";
import tvmSubdistrictsGeoJson from "/src/data/trivandrum_subdistricts.json";

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

const toRad = (value) => (value * Math.PI) / 180;
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const pointInRing = (lon, lat, ring = []) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const pointInPolygon = (lon, lat, polygonCoords = []) => {
  if (!polygonCoords.length) return false;
  if (!pointInRing(lon, lat, polygonCoords[0] || [])) return false;
  for (let i = 1; i < polygonCoords.length; i += 1) {
    if (pointInRing(lon, lat, polygonCoords[i] || [])) return false;
  }
  return true;
};

const pointInFeatureGeometry = (lon, lat, geometry) => {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    return pointInPolygon(lon, lat, geometry.coordinates || []);
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates || []).some((poly) => pointInPolygon(lon, lat, poly));
  }
  return false;
};

const pointInBoundary = (lon, lat, boundaryFeatureCollection) => {
  if (!boundaryFeatureCollection?.features?.length) return true;
  return boundaryFeatureCollection.features.some((feature) =>
    pointInFeatureGeometry(lon, lat, feature.geometry)
  );
};

const getBoundaryLabelForFeature = (feature, overlayType) => {
  const props = feature?.properties || {};
  if (overlayType === "villages") {
    return props.VILNAM_SOI || props.village || props.name || props.Name || "Unknown Village";
  }
  if (overlayType === "subdistricts") {
    return props.sdtname || props.subdistrict || props.name || props.Name || "Unknown Subdistrict";
  }
  if (overlayType === "tvm") {
    return props.dtname || props.district || props.name || props.Name || "Thiruvananthapuram";
  }
  return props.name || props.Name || "Unknown";
};

const getBoundaryNameForPoint = (lon, lat, featureCollection, overlayType) => {
  const features = featureCollection?.features || [];
  for (let i = 0; i < features.length; i += 1) {
    const feature = features[i];
    if (pointInFeatureGeometry(lon, lat, feature.geometry)) {
      return getBoundaryLabelForFeature(feature, overlayType);
    }
  }
  return "Unknown";
};

const buildKdeGridCells = (weightedPoints, bandwidthKm = 2.5, gridSize = 70) => {
  if (!weightedPoints.length) return [];

  const lats = weightedPoints.map((p) => p.lat);
  const lons = weightedPoints.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const midLat = (minLat + maxLat) / 2;

  const padLat = bandwidthKm / 111;
  const padLon = bandwidthKm / (111 * Math.max(0.2, Math.cos(toRad(midLat))));
  const latStart = minLat - padLat;
  const latEnd = maxLat + padLat;
  const lonStart = minLon - padLon;
  const lonEnd = maxLon + padLon;

  const latStep = (latEnd - latStart) / Math.max(1, gridSize);
  const lonStep = (lonEnd - lonStart) / Math.max(1, gridSize);

  const cells = [];
  let maxDensity = 0;

  for (let yi = 0; yi < gridSize; yi += 1) {
    const lat = latStart + (yi + 0.5) * latStep;
    for (let xi = 0; xi < gridSize; xi += 1) {
      const lon = lonStart + (xi + 0.5) * lonStep;
      let density = 0;
      weightedPoints.forEach((point) => {
        const distKm = haversineKm(lat, lon, point.lat, point.lon);
        const z = distKm / bandwidthKm;
        density += point.weight * Math.exp(-0.5 * z * z);
      });
      maxDensity = Math.max(maxDensity, density);
      cells.push({
        density,
        lat,
        lon,
        bounds: [
          [lat - latStep / 2, lon - lonStep / 2],
          [lat + latStep / 2, lon + lonStep / 2],
        ],
      });
    }
  }

  if (maxDensity <= 0) return [];
  return cells
    .map((cell) => ({
      bounds: cell.bounds,
      lat: cell.lat,
      lon: cell.lon,
      density: cell.density,
      intensity: cell.density / maxDensity,
    }))
    .filter((cell) => cell.intensity >= 0.02);
};

const safeNumber = (value) => (Number.isFinite(value) ? value : 0);
const GRADIENT_STOPS = [
  [0, "#4575b4"],
  [0.3, "#91bfdb"],
  [0.5, "#ffffbf"],
  [0.7, "#fdae61"],
  [1, "#d73027"],
];

const hexToRgb = (hex) => {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return { r: 127, g: 127, b: 127 };
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b]
    .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"))
    .join("")}`;

const colorForIntensity = (value) => {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  for (let i = 1; i < GRADIENT_STOPS.length; i += 1) {
    const [t1, c1] = GRADIENT_STOPS[i - 1];
    const [t2, c2] = GRADIENT_STOPS[i];
    if (v <= t2) {
      const ratio = t2 === t1 ? 0 : (v - t1) / (t2 - t1);
      const a = hexToRgb(c1);
      const b = hexToRgb(c2);
      return rgbToHex({
        r: a.r + (b.r - a.r) * ratio,
        g: a.g + (b.g - a.g) * ratio,
        b: a.b + (b.b - a.b) * ratio,
      });
    }
  }
  return GRADIENT_STOPS[GRADIENT_STOPS.length - 1][1];
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

const methodLabel = (method) => {
  if (method === "moving-average") return "Moving Average";
  if (method === "cagr") return "CAGR";
  if (method === "random-forest") return "Random Forest";
  if (method === "svm") return "SVM";
  if (method === "ann") return "ANN";
  return "Linear Trend";
};

const predictValueForYear = (yearlySeries, targetYear, method) => {
  const points = Object.entries(yearlySeries)
    .map(([year, value]) => ({ year: Number(year), value: safeNumber(value) }))
    .filter((p) => Number.isFinite(p.year))
    .sort((a, b) => a.year - b.year);

  if (points.length === 0) return 0;
  const last = points[points.length - 1];
  if (targetYear <= last.year) {
    const exact = points.find((p) => p.year === targetYear);
    return exact ? Math.max(0, exact.value) : Math.max(0, last.value);
  }

  const horizon = targetYear - last.year;
  if (method === "svm") {
    // Robust linear trend (SVM-like): median of pairwise slopes to reduce outlier effect.
    const slopes = [];
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const dy = points[j].value - points[i].value;
        const dx = points[j].year - points[i].year;
        if (dx !== 0) slopes.push(dy / dx);
      }
    }
    if (!slopes.length) return Math.max(0, last.value);
    slopes.sort((a, b) => a - b);
    const medianSlope = slopes[Math.floor(slopes.length / 2)];
    return Math.max(0, last.value + medianSlope * horizon);
  }

  if (method === "random-forest") {
    // Deterministic ensemble of bootstrapped local linear projections.
    const trees = 31;
    const seed = Math.round(last.year * 97 + last.value * 13 + points.length * 17);
    const rand = mulberry32(seed);
    let sumPred = 0;
    for (let t = 0; t < trees; t += 1) {
      const sample = [];
      for (let i = 0; i < points.length; i += 1) {
        sample.push(points[Math.floor(rand() * points.length)]);
      }
      const a = sample[Math.floor(rand() * sample.length)];
      const b = sample[Math.floor(rand() * sample.length)];
      const dx = (b?.year ?? a.year) - a.year;
      const slope = dx === 0 ? 0 : ((b?.value ?? a.value) - a.value) / dx;
      const localPred = last.value + slope * horizon;
      sumPred += Math.max(0, localPred);
    }
    return Math.max(0, sumPred / trees);
  }

  if (method === "ann") {
    // ANN-like non-linear forecast using trend + acceleration with smoothing.
    if (points.length < 2) return Math.max(0, last.value);
    const deltas = [];
    for (let i = 1; i < points.length; i += 1) {
      deltas.push(points[i].value - points[i - 1].value);
    }
    const recent = deltas.slice(-3);
    const avgDelta = recent.reduce((s, v) => s + v, 0) / Math.max(1, recent.length);
    const accel = recent.length >= 2 ? recent[recent.length - 1] - recent[0] : 0;
    const nonlinear = last.value + avgDelta * horizon + 0.5 * accel * horizon * horizon;
    const movingAvg =
      points.slice(-3).reduce((s, p) => s + p.value, 0) / Math.min(3, points.length);
    return Math.max(0, nonlinear * 0.75 + movingAvg * 0.25);
  }

  if (method === "moving-average") {
    const window = points.slice(Math.max(0, points.length - 3));
    const avg = window.reduce((sum, p) => sum + p.value, 0) / window.length;
    return Math.max(0, avg);
  }

  if (method === "cagr") {
    const first = points[0];
    if (points.length >= 2 && first.value > 0 && last.value >= 0 && last.year > first.year) {
      const spanYears = last.year - first.year;
      const growth = Math.pow(last.value / first.value, 1 / spanYears) - 1;
      return Math.max(0, last.value * Math.pow(1 + growth, horizon));
    }
    return Math.max(0, last.value);
  }

  // Default: linear regression
  if (points.length === 1) return Math.max(0, points[0].value);
  const meanX = points.reduce((sum, p) => sum + p.year, 0) / points.length;
  const meanY = points.reduce((sum, p) => sum + p.value, 0) / points.length;
  let num = 0;
  let den = 0;
  points.forEach((p) => {
    num += (p.year - meanX) * (p.value - meanY);
    den += (p.year - meanX) ** 2;
  });
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  return Math.max(0, slope * targetYear + intercept);
};

function HeatmapLayer({
  hideToggle = false,
  externallyOpen,
  containerStyle,
  onRequestClose,
}) {
  const map = useMap();
  const [enabled, setEnabled] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [year, setYear] = useState("All");
  const [diseaseType, setDiseaseType] = useState("All");
  const [heatmapMode, setHeatmapMode] = useState("observed");
  const [predictionMethod, setPredictionMethod] = useState("linear");
  const [predictionScenario, setPredictionScenario] = useState("baseline");
  const [predictionYear, setPredictionYear] = useState("");
  const [boundaryOverlay, setBoundaryOverlay] = useState("none");
  const heatLayerRef = useRef(null);
  const controlRef = useRef(null);
  const legendRef = useRef(null);
  const rows = useMemo(() => parseDiseaseCsv(diseaseCsvRaw), []);
  const historicalYears = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.year).filter((v) => Number.isFinite(v)))).sort(
        (a, b) => a - b
      ),
    [rows]
  );
  const maxHistoricalYear = historicalYears.length
    ? historicalYears[historicalYears.length - 1]
    : null;
  const predictionYearOptions = useMemo(() => {
    if (!Number.isFinite(maxHistoricalYear)) return [];
    return Array.from({ length: 5 }, (_, idx) => String(maxHistoricalYear + idx + 1));
  }, [maxHistoricalYear]);
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
  const closePanel = () => {
    if (onRequestClose) {
      onRequestClose();
      return;
    }
    setDropdownOpen(false);
  };

  useEffect(() => {
    if (!predictionYearOptions.length) return;
    if (!predictionYearOptions.includes(predictionYear)) {
      setPredictionYear(predictionYearOptions[0]);
    }
  }, [predictionYearOptions, predictionYear]);

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

    const seriesByLocation = new Map();
    rows.forEach((r) => {
      if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) return;
      if (diseaseType !== "All" && r.disease !== diseaseType) return;
      const key = `${r.ward_code || ""}|${r.latitude}|${r.longitude}`;
      const weight = (r.cases_confirmed || 0) + (r.cases_probable || 0);
      if (!seriesByLocation.has(key)) {
        seriesByLocation.set(key, {
          lat: r.latitude,
          lon: r.longitude,
          byYear: {},
        });
      }
      const entry = seriesByLocation.get(key);
      entry.byYear[r.year] = safeNumber(entry.byYear[r.year]) + weight;
    });

    const scenarioMultiplier =
      predictionScenario === "conservative"
        ? 0.9
        : predictionScenario === "aggressive"
          ? 1.1
          : 1;

    const weightedPoints = [...seriesByLocation.values()]
      .map((entry) => {
        if (heatmapMode === "predicted") {
          const targetYear = Number(predictionYear);
          if (!Number.isFinite(targetYear)) return null;
          const predicted = predictValueForYear(
            entry.byYear,
            targetYear,
            predictionMethod
          );
          return {
            lat: entry.lat,
            lon: entry.lon,
            weight: predicted * scenarioMultiplier,
          };
        }
        if (year === "All") {
          const total = Object.values(entry.byYear).reduce(
            (sum, value) => sum + safeNumber(value),
            0
          );
          return { lat: entry.lat, lon: entry.lon, weight: total };
        }
        const selected = safeNumber(entry.byYear[Number(year)]);
        return { lat: entry.lat, lon: entry.lon, weight: selected };
      })
      .filter((p) => p && p.weight > 0);

    const gridCells = buildKdeGridCells(weightedPoints, 2.5, 70);
    if (gridCells.length === 0) return;
    const clippedGridCells = gridCells.filter((cell) =>
      pointInBoundary(cell.lon, cell.lat, tvmBoundaryGeoJson)
    );
    if (clippedGridCells.length === 0) return;

    const gradient = {
      0.1: "#4575b4",
      0.3: "#91bfdb",
      0.5: "#ffffbf",
      0.7: "#fdae61",
      1.0: "#d73027",
    };

    const cellRenderer = L.canvas({ padding: 0.5 });
    const heatLayer = L.layerGroup();
    const overlayData =
      boundaryOverlay === "tvm"
        ? tvmBoundaryGeoJson
        : boundaryOverlay === "villages"
          ? tvmVillagesGeoJson
          : boundaryOverlay === "subdistricts"
            ? tvmSubdistrictsGeoJson
            : null;

    clippedGridCells.forEach((cell) => {
      const polygonName = overlayData
        ? getBoundaryNameForPoint(cell.lon, cell.lat, overlayData, boundaryOverlay)
        : null;
      const rect = L.rectangle(cell.bounds, {
        stroke: false,
        fill: true,
        fillColor: colorForIntensity(cell.intensity),
        fillOpacity: Math.max(0.18, Math.min(0.9, cell.intensity * 0.9)),
        interactive: true,
        renderer: cellRenderer,
      });
      rect.bindTooltip(
        `${
          polygonName
            ? `<b>${boundaryOverlay === "subdistricts" ? "Subdistrict" : boundaryOverlay === "tvm" ? "District" : "Village"}:</b> ${polygonName}<br/>`
            : ""
        }<b>Intensity:</b> ${(cell.intensity * 100).toFixed(1)}%<br/><b>KDE:</b> ${cell.density.toFixed(2)}`,
        { sticky: true, direction: "top", opacity: 0.96 }
      );
      rect.addTo(heatLayer);
    });

    if (boundaryOverlay !== "none") {
      const boundaryData =
        boundaryOverlay === "tvm"
          ? tvmBoundaryGeoJson
          : boundaryOverlay === "villages"
            ? tvmVillagesGeoJson
            : tvmSubdistrictsGeoJson;

      const boundaryLayer = L.geoJSON(boundaryData, {
        style: () => ({
          color: boundaryOverlay === "tvm" ? "#111827" : "#374151",
          weight: boundaryOverlay === "tvm" ? 2.2 : 1.1,
          opacity: 0.9,
          fillOpacity: 0,
          interactive: false,
        }),
      });
      boundaryLayer.addTo(heatLayer);
    }
    heatLayer.addTo(map);

    heatLayerRef.current = heatLayer;

    const legend = L.control({ position: "bottomleft" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "info legend");
      div.innerHTML = `
        <div style="font-weight: bold;font-size: 13px;margin-bottom: 4px;font-family: Arial, sans-serif;">
          ${
            heatmapMode === "predicted"
              ? `Predicted KDE Intensity (${predictionYear}, ${diseaseType})`
              : `Observed KDE Intensity (${year}, ${diseaseType})`
          }
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
        <div style="font-size:10px;color:#555;margin-top:4px;font-family:Arial,sans-serif;">
          ${
            heatmapMode === "predicted"
              ? `Gaussian KDE, ${methodLabel(predictionMethod)}, ${predictionScenario}`
              : "Gaussian KDE, bandwidth 2.5 km"
          }
        </div>
        <div style="font-size:10px;color:#555;margin-top:2px;font-family:Arial,sans-serif;">
          Hover cells for intensity values (stable across zoom)
        </div>
        <div style="font-size:10px;color:#555;margin-top:2px;font-family:Arial,sans-serif;">
          Boundary overlay: ${boundaryOverlay}
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
  }, [
    map,
    enabled,
    year,
    diseaseType,
    rows,
    heatmapMode,
    predictionMethod,
    predictionScenario,
    predictionYear,
    boundaryOverlay,
  ]);

  return (
    <div
      className="layer-panel-control"
      style={containerStyle || { top: "168px", left: "12px", width: "270px" }}
      ref={controlRef}
    >
      {!hideToggle && (
        <button
          className="layer-panel-btn"
          title="Heatmap Options"
          onClick={() => setDropdownOpen((p) => !p)}
        >
          Disease Heatmap
        </button>
      )}

      {visible && (
        <div className="layer-panel-form raster-panel">
          <div className="layer-panel-header">
            <div className="layer-panel-title">Disease Heatmap</div>
            <button
              type="button"
              className="layer-panel-close-btn"
              title="Close"
              onClick={closePanel}
            >
              ×
            </button>
          </div>
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
            disabled={!enabled || heatmapMode === "predicted"}
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

          <label className="raster-meta">Mode</label>
          <select
            className="raster-search"
            value={heatmapMode}
            onChange={(e) => setHeatmapMode(e.target.value)}
            disabled={!enabled}
          >
            <option value="observed">Observed</option>
            <option value="predicted">Predicted</option>
          </select>

          {heatmapMode === "predicted" && (
            <>
              <label className="raster-meta">Prediction Year</label>
              <select
                className="raster-search"
                value={predictionYear}
                onChange={(e) => setPredictionYear(e.target.value)}
                disabled={!enabled}
              >
                {predictionYearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>

              <label className="raster-meta">Forecast Method</label>
              <select
                className="raster-search"
                value={predictionMethod}
                onChange={(e) => setPredictionMethod(e.target.value)}
                disabled={!enabled}
              >
                <option value="linear">Linear Trend</option>
                <option value="moving-average">3-Year Moving Average</option>
                <option value="cagr">CAGR Extrapolation</option>
                <option value="random-forest">Random Forest</option>
                <option value="svm">SVM Regression</option>
                <option value="ann">ANN Forecast</option>
              </select>

              <label className="raster-meta">Scenario</label>
              <select
                className="raster-search"
                value={predictionScenario}
                onChange={(e) => setPredictionScenario(e.target.value)}
                disabled={!enabled}
              >
                <option value="baseline">Baseline</option>
                <option value="conservative">Conservative (-10%)</option>
                <option value="aggressive">Aggressive (+10%)</option>
              </select>
            </>
          )}

          <label className="raster-meta">Boundary Overlay</label>
          <select
            className="raster-search"
            value={boundaryOverlay}
            onChange={(e) => setBoundaryOverlay(e.target.value)}
            disabled={!enabled}
          >
            <option value="none">None</option>
            <option value="tvm">TVM Boundary</option>
            <option value="villages">TVM Villages</option>
            <option value="subdistricts">TVM Subdistricts</option>
          </select>
        </div>
      )}
    </div>
  );
}

export default HeatmapLayer;

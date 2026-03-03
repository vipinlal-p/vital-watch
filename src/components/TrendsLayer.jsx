// src/components/TrendsLayer.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import Chart from "chart.js/auto";
import "../styles/map-controls.css";
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
      year: Number(get("year")),
      disease: get("disease"),
      cases_confirmed: Number(get("cases_confirmed")) || 0,
      cases_probable: Number(get("cases_probable")) || 0,
    };
  });
};

function TrendsLayer({
  hideToggle = false,
  externallyOpen,
  onRequestClose,
}) {
  const map = useMap();
  const [enabled, setEnabled] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedWard, setSelectedWard] = useState("all");
  const [selectedDiseaseType, setSelectedDiseaseType] = useState("all");
  const [yearRange, setYearRange] = useState([null, null]);
  const [yearBounds, setYearBounds] = useState([null, null]);
  const controlRef = useRef(null);
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const diseaseRows = useMemo(() => parseDiseaseCsv(diseaseCsvRaw), []);

  // ✅ configurable prediction horizon
  const predictionHorizon = 2; // change this to 2, 3, 5 etc.

  useEffect(() => {
    if (typeof externallyOpen === "boolean") {
      setEnabled(externallyOpen);
    }
  }, [externallyOpen]);

  // ✅ Prevent clicks passing through to map
  useEffect(() => {
    if (controlRef.current) {
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  // ✅ Load disease trend data from local CSV
  useEffect(() => {
    if (!enabled) return;
    setLoading(true);

    try {
      const grouped = {};
      const allYears = new Set();

      diseaseRows.forEach((row) => {
        if (!Number.isFinite(row.year)) return;
        const ward = row.ward_code || row.ward_name;
        const wardName = row.ward_name || row.ward_code;
        const disease = row.disease || "Unknown";
        const totalCases = (row.cases_confirmed || 0) + (row.cases_probable || 0);

        allYears.add(row.year);
        if (!grouped[ward]) grouped[ward] = { name: wardName, yearly: {} };
        if (!grouped[ward].yearly[row.year]) grouped[ward].yearly[row.year] = {};
        grouped[ward].yearly[row.year][disease] =
          (grouped[ward].yearly[row.year][disease] || 0) + totalCases;
      });

      const yearsSorted = [...allYears].sort((a, b) => a - b);
      if (yearsSorted.length > 0) {
        setYearBounds([yearsSorted[0], yearsSorted[yearsSorted.length - 1]]);
        setYearRange([yearsSorted[0], yearsSorted[yearsSorted.length - 1]]);
      }

      setData(grouped);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [enabled, diseaseRows]);

  // ✅ Build chart
  useEffect(() => {
    if (
      !enabled ||
      !data ||
      !chartRef.current ||
      !yearRange[0] ||
      !yearRange[1]
    )
      return;

    let datasetYears = [];
    let datasetValues = [];

    if (selectedWard === "all") {
      const yearlyTotals = {};
      Object.values(data).forEach((ward) => {
        Object.entries(ward.yearly).forEach(([yr, diseaseTypes]) => {
          if (!yearlyTotals[yr]) yearlyTotals[yr] = 0;
          if (selectedDiseaseType === "all") {
            yearlyTotals[yr] += Object.values(diseaseTypes).reduce(
              (a, b) => a + b,
              0
            );
          } else {
            yearlyTotals[yr] += diseaseTypes[selectedDiseaseType] || 0;
          }
        });
      });
      datasetYears = Object.keys(yearlyTotals).map(Number).sort();
      datasetValues = datasetYears.map((y) => yearlyTotals[y]);
    } else {
      const ward = data[selectedWard];
      if (!ward) return;
      datasetYears = Object.keys(ward.yearly).map(Number).sort();
      datasetValues = datasetYears.map((y) => {
        if (selectedDiseaseType === "all") {
          return Object.values(ward.yearly[y] || {}).reduce((a, b) => a + b, 0);
        }
        return ward.yearly[y]?.[selectedDiseaseType] || 0;
      });
    }

    const filteredPairs = datasetYears
      .map((y, i) => [y, datasetValues[i]])
      .filter(([y]) => y >= yearRange[0] && y <= yearRange[1]);
    datasetYears = filteredPairs.map(([y]) => y);
    datasetValues = filteredPairs.map(([, value]) => value || 0);

    if (datasetYears.length < 2) return;
    if (yearRange[1] === null || yearRange[1] === undefined) return;

    const meanX = datasetYears.reduce((a, b) => a + b, 0) / datasetYears.length;
    const meanY = datasetValues.reduce((a, b) => a + b, 0) / datasetValues.length;
    let num = 0;
    let den = 0;
    for (let i = 0; i < datasetYears.length; i += 1) {
      num += (datasetYears[i] - meanX) * (datasetValues[i] - meanY);
      den += (datasetYears[i] - meanX) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = meanY - slope * meanX;

    const futureYears = Array.from(
      { length: predictionHorizon },
      (_, i) => Number(yearRange[1]) + i + 1
    );
    const futureValues = futureYears.map((y) =>
      Math.max(0, Math.round(slope * y + intercept))
    );

    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    chartInstanceRef.current = new Chart(chartRef.current, {
      type: "line",
      data: {
        labels: [...datasetYears, ...futureYears],
        datasets: [
          {
            label: "Reported Disease Cases (Actual)",
            data: datasetValues,
            borderColor: "blue",
            fill: false,
            tension: 0.2,
            borderWidth: 2,
          },
          {
            label: "Predicted Disease Cases",
            data: [
              ...Array(datasetYears.length - 1).fill(null),
              datasetValues[datasetValues.length - 1],
              ...futureValues,
            ],
            borderColor: "red",
            borderDash: [4, 4],
            fill: false,
            tension: 0.2,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true },
          title: {
            display: true,
            text: `Disease Trends - ${
              selectedWard === "all" ? "All Wards" : data[selectedWard].name
            } (${
              selectedDiseaseType === "all"
                ? "All Diseases"
                : selectedDiseaseType
            })`,
          },
        },
        scales: {
          x: { title: { display: true, text: "Year" } },
          y: { title: { display: true, text: "Number of Cases" } },
        },
      },
    });
  }, [enabled, data, selectedWard, selectedDiseaseType, yearRange]);

  // ✅ Save as high-resolution PNG (300 dpi @ 6 inch width)
  const handleDownload = () => {
    if (!chartInstanceRef.current) return;

    // --- Desired print size ---
    const printWidthInches = 6; // or your journal’s column width
    const dpi = 300;
    const targetWidth = printWidthInches * dpi; // 1800 px
    const aspect =
      chartInstanceRef.current.height / chartInstanceRef.current.width;
    const targetHeight = targetWidth * aspect; // scale height

    // --- Create an off-screen canvas at high resolution ---
    const canvas = chartInstanceRef.current.canvas;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = targetWidth;
    exportCanvas.height = targetHeight;

    const ctx = exportCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; // white background
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // draw chart scaled up
    ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

    // --- Save as PNG (lossless) ---
    const link = document.createElement("a");
    link.href = exportCanvas.toDataURL("image/png"); // use PNG/TIFF for publication
    link.download = `disease_trends_${selectedWard}_${selectedDiseaseType}_300dpi.png`;
    link.click();
  };

  return (
    <>
      {!hideToggle && (
        <div
          className="custom-layer-control"
          style={{ top: "340px" }}
          ref={controlRef}
        >
          <button
            className={`custom-toggle-btn ${enabled ? "active" : ""}`}
            title="Toggle Disease Trends"
            onClick={() => setEnabled((p) => !p)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={enabled ? "#1976d2" : "currentColor"}
            >
              <path d="M3 17h2v2H3v-2zm4-4h2v6H7v-6zm4-4h2v10h-2V9zm4-4h2v14h-2V5zm4 8h2v6h-2v-6z" />
              <path d="M2 19h20v2H2v-2z" />
            </svg>
          </button>
        </div>
      )}

      {/* 📊 Modal */}
      {enabled && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "650px",
            maxHeight: "80vh",
            background: "white",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
            zIndex: 1000,
            overflowY: "auto",
          }}
        >
          <button
            onClick={() => {
              if (onRequestClose) {
                onRequestClose();
              } else {
                setEnabled(false);
              }
            }}
            style={{
              position: "absolute",
              top: "10px",
              right: "15px",
              background: "transparent",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
            }}
          >
            ✖
          </button>

          <h3 style={{ marginBottom: "16px" }}>Disease Trends Model</h3>

          {/* Ward filter */}
          <label className="custom-option" style={{ marginBottom: "10px" }}>
            <span>Ward:</span>
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              style={{ marginLeft: "10px" }}
            >
              <option value="all">All</option>
              {data &&
                Object.entries(data)
                  .sort((a, b) => a[1].name.localeCompare(b[1].name))
                  .map(([id, ward]) => (
                    <option key={id} value={id}>
                      {ward.name}
                    </option>
                  ))}
            </select>
          </label>

          {/* Disease filter */}
          <label className="custom-option" style={{ marginBottom: "10px" }}>
            <span>Disease:</span>
            <select
              value={selectedDiseaseType}
              onChange={(e) => setSelectedDiseaseType(e.target.value)}
              style={{ marginLeft: "10px" }}
            >
              <option value="all">All</option>
              {data &&
                Array.from(
                  new Set(
                    Object.values(data).flatMap((ward) =>
                      Object.values(ward.yearly).flatMap((y) => Object.keys(y))
                    )
                  )
                )
                  .sort((a, b) => a.localeCompare(b))
                  .map((disease) => (
                    <option key={disease} value={disease}>
                      {disease}
                    </option>
                  ))}
            </select>
          </label>

          {/* Year range filter */}
          <label className="custom-option" style={{ marginBottom: "20px" }}>
            <span>Year Range:</span>
            <input
              type="number"
              value={yearRange[0] || ""}
              min={yearBounds[0] || 2000}
              max={yearBounds[1] || 2100}
              onChange={(e) => setYearRange([+e.target.value, yearRange[1]])}
              style={{ width: "80px", margin: "0 6px" }}
            />
            -
            <input
              type="number"
              value={yearRange[1] || ""}
              min={yearBounds[0] || 2000}
              max={yearBounds[1] || 2100}
              onChange={(e) => setYearRange([yearRange[0], +e.target.value])}
              style={{ width: "80px", margin: "0 6px" }}
            />
          </label>

          {/* Save button */}
          <button
            onClick={handleDownload}
            style={{
              marginBottom: "15px",
              padding: "8px 12px",
              background: "#1976d2",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            📥 Save Chart as PNG
          </button>

          {loading ? (
            <p>Loading data...</p>
          ) : data ? (
            <canvas ref={chartRef} width="650" height="400"></canvas>
          ) : (
            <p>No data available</p>
          )}
        </div>
      )}
    </>
  );
}

export default TrendsLayer;

// src/components/TrendsLayer.jsx
import { useEffect, useState, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import Chart from "chart.js/auto";
import { GEOSERVER_OWS_URL, apiUrl } from "/src/config/endpoints";
import "../styles/map-controls.css";

function TrendsLayer() {
  const map = useMap();
  const [enabled, setEnabled] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedStation, setSelectedStation] = useState("all");
  const [selectedCrimeType, setSelectedCrimeType] = useState("all");
  const [yearRange, setYearRange] = useState([null, null]);
  const [yearBounds, setYearBounds] = useState([null, null]); // ✅ dynamic min/max
  const controlRef = useRef(null);
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // ✅ configurable prediction horizon
  const predictionHorizon = 2; // change this to 2, 3, 5 etc.

  // ✅ Prevent clicks passing through to map
  useEffect(() => {
    if (controlRef.current) {
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  // ✅ Check login status
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoggedIn(false);
      return;
    }

    fetch(apiUrl("/api/profile"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid token");
        return res.json();
      })
      .then(() => setIsLoggedIn(true))
      .catch(() => {
        localStorage.removeItem("token");
        setIsLoggedIn(false);
      });
  }, []);

  // ✅ Fetch data
  useEffect(() => {
    if (!enabled) return;
    setLoading(true);

    const url =
      `${GEOSERVER_OWS_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=crime_map_app:crime_records_all&outputFormat=application/json`;

    fetch(url)
      .then((res) => res.json())
      .then((geojson) => {
        const grouped = {};
        const allYears = new Set();

        geojson.features.forEach((f) => {
          const ps = f.properties.station_id;
          const psName = f.properties.police_station;
          const yr = f.properties.year;
          const crimes = f.properties.crime_count;
          const type = f.properties.crime_type;

          allYears.add(yr);

          if (!grouped[ps]) grouped[ps] = { name: psName, yearly: {} };
          if (!grouped[ps].yearly[yr]) grouped[ps].yearly[yr] = {};
          grouped[ps].yearly[yr][type] = crimes;
        });

        const yearsSorted = [...allYears].sort((a, b) => a - b);
        if (yearsSorted.length > 0) {
          setYearBounds([yearsSorted[0], yearsSorted[yearsSorted.length - 1]]);
          setYearRange([yearsSorted[0], yearsSorted[yearsSorted.length - 1]]);
        }

        setData(grouped);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [enabled]);

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

    if (selectedStation === "all") {
      const yearlyTotals = {};
      Object.values(data).forEach((station) => {
        Object.entries(station.yearly).forEach(([yr, crimeTypes]) => {
          if (!yearlyTotals[yr]) yearlyTotals[yr] = 0;
          if (selectedCrimeType === "all") {
            yearlyTotals[yr] += Object.values(crimeTypes).reduce(
              (a, b) => a + b,
              0
            );
          } else {
            yearlyTotals[yr] += crimeTypes[selectedCrimeType] || 0;
          }
        });
      });
      datasetYears = Object.keys(yearlyTotals).map(Number).sort();
      datasetValues = datasetYears.map((y) => yearlyTotals[y]);
    } else {
      const station = data[selectedStation];
      if (!station) return;
      datasetYears = Object.keys(station.yearly).map(Number).sort();
      datasetValues = datasetYears.map((y) => {
        if (selectedCrimeType === "all") {
          return Object.values(station.yearly[y] || {}).reduce(
            (a, b) => a + b,
            0
          );
        } else {
          return station.yearly[y]?.[selectedCrimeType] || 0;
        }
      });
    }

    // ✅ Filter by selected year range
    datasetYears = datasetYears.filter(
      (y) => y >= yearRange[0] && y <= yearRange[1]
    );
    datasetValues = datasetYears.map((y, i) => datasetValues[i] || 0);

    // Regression
    const n = datasetYears.length;
    if (n < 2) return;
    const meanX = datasetYears.reduce((a, b) => a + b, 0) / n;
    const meanY = datasetValues.reduce((a, b) => a + b, 0) / n;
    let num = 0,
      den = 0;
    for (let i = 0; i < n; i++) {
      num += (datasetYears[i] - meanX) * (datasetValues[i] - meanY);
      den += (datasetYears[i] - meanX) ** 2;
    }
    const slope = num / den;
    const intercept = meanY - slope * meanX;

    // ✅ Predict configurable horizon
    const futureYears = Array.from(
      { length: predictionHorizon },
      (_, i) => yearRange[1] + i + 1
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
            label: "Reported Crimes (Actual)",
            data: datasetValues,
            borderColor: "blue",
            fill: false,
            tension: 0.2,
            borderWidth: 2,
          },
          {
            label: "Predicted Crimes",
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
            text: `Crime Trends - ${
              selectedStation === "all"
                ? "All Stations"
                : data[selectedStation].name
            } (${
              selectedCrimeType === "all" ? "All Crimes" : selectedCrimeType
            })`,
          },
        },
        scales: {
          x: { title: { display: true, text: "Year" } },
          y: { title: { display: true, text: "Number of Crimes" } },
        },
      },
    });
  }, [enabled, data, selectedStation, selectedCrimeType, yearRange]);

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
    link.download = `crime_trends_${selectedStation}_${selectedCrimeType}_300dpi.png`;
    link.click();
  };

  return (
    <>
      {/* 📈 Button */}
      <div
        className="custom-layer-control"
        style={{ top: "440px" }}
        ref={controlRef}
      >
        <button
          className={`custom-toggle-btn ${enabled ? "active" : ""}`}
          title="Toggle Crime Trends"
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
            onClick={() => setEnabled(false)}
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

          <h3 style={{ marginBottom: "16px" }}>Crime Trends Model</h3>

          {/* Station filter */}
          <label className="custom-option" style={{ marginBottom: "10px" }}>
            <span>Police Station:</span>
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              style={{ marginLeft: "10px" }}
            >
              <option value="all">All</option>
              {data &&
                Object.entries(data)
                  // ✅ sort by station name
                  .sort((a, b) => a[1].name.localeCompare(b[1].name))
                  .map(([id, st]) => (
                    <option key={id} value={id}>
                      {st.name}
                    </option>
                  ))}
            </select>
          </label>

          {/* Crime type filter */}
          <label className="custom-option" style={{ marginBottom: "10px" }}>
            <span>Crime Type:</span>
            <select
              value={selectedCrimeType}
              onChange={(e) => setSelectedCrimeType(e.target.value)}
              style={{ marginLeft: "10px" }}
            >
              <option value="all">All</option>
              {data &&
                Array.from(
                  new Set(
                    Object.values(data).flatMap((st) =>
                      Object.values(st.yearly).flatMap((y) => Object.keys(y))
                    )
                  )
                )
                  // ✅ sort alphabetically
                  .sort((a, b) => a.localeCompare(b))
                  .map((ct) => (
                    <option key={ct} value={ct}>
                      {ct}
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
          {isLoggedIn && (
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
          )}

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

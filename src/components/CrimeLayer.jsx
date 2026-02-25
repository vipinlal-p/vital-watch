// src/components/CrimeLayer.jsx
import { useEffect, useState, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { GEOSERVER_OWS_URL, apiUrl } from "/src/config/endpoints";
import "../styles/map-controls.css";

function CrimeLayer() {
  const map = useMap();
  const [enabled, setEnabled] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const layerRef = useRef(null);
  const toggleRef = useRef(null);

  // ✅ prevent toggle clicks/scrolls from reaching the map
  useEffect(() => {
    if (toggleRef.current) {
      L.DomEvent.disableClickPropagation(toggleRef.current);
      L.DomEvent.disableScrollPropagation(toggleRef.current);
    }
  }, []);

  // ✅ Check login state (sync with localStorage + API)
  useEffect(() => {
    function checkLogin() {
      const token = localStorage.getItem("token");
      if (!token) {
        setIsLoggedIn(false);
        return;
      }
      fetch(apiUrl("/api/profile"), {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? setIsLoggedIn(true) : setIsLoggedIn(false)))
        .catch(() => setIsLoggedIn(false));
    }

    checkLogin();
    window.addEventListener("storage", checkLogin);
    return () => window.removeEventListener("storage", checkLogin);
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

    const url =
      `${GEOSERVER_OWS_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=crime_map_app:crime_records_all&outputFormat=application/json`;

    let isCancelled = false;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (isCancelled) return;

        const geoJsonLayer = L.geoJSON(data, {
          pointToLayer: (feature, latlng) =>
            L.circleMarker(latlng, {
              radius: 6, // ✅ fixed size for all points
              fillColor: "#ff4d4d",
              color: "#800000",
              weight: 1,
              fillOpacity: 0.8,
            }),

          onEachFeature: (feature, layer) => {
            const props = feature.properties;

            const popupContent = `
              <b>Police Station:</b> ${props.police_station}<br/>
              <b>District:</b> ${props.district}<br/>
              <b>Total Crimes:</b> ${props.total_crimes}<br/>
              <button id="view-more-${props.station_id}" 
                style="margin-top:6px; padding:3px 6px; background:#1976d2; color:white; border:none; border-radius:4px; cursor:pointer;">
                View More
              </button>
              ${
                isLoggedIn
                  ? `<button id="download-${props.station_id}" 
                      style="margin-left:6px; margin-top:6px; padding:3px 6px; background:green; color:white; border:none; border-radius:4px; cursor:pointer;">
                      Download CSV
                    </button>`
                  : ""
              }
              <div id="details-${
                props.station_id
              }" style="margin-top:8px; max-height:150px; overflow-y:auto;"></div>
            `;

            layer.bindPopup(popupContent);

            layer.on("popupopen", () => {
              // 📌 "View More" button
              const btn = document.getElementById(
                `view-more-${props.station_id}`
              );
              if (btn) {
                btn.addEventListener("click", () => {
                  const detailUrl = `${GEOSERVER_OWS_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=crime_map_app:crime_records&outputFormat=application/json&CQL_FILTER=station_id=${props.station_id}`;

                  fetch(detailUrl)
                    .then((res) => res.json())
                    .then((details) => {
                      const grouped = {};

                      details.features.forEach((f) => {
                        const year = f.properties.year;
                        const type = f.properties.crime_type;
                        const count = f.properties.crime_count;

                        if (!grouped[year]) grouped[year] = {};
                        grouped[year][type] =
                          (grouped[year][type] || 0) + count;
                      });

                      let detailHtml = "";
                      for (const [year, types] of Object.entries(grouped)) {
                        detailHtml += `<b>${year}</b><ul>`;
                        for (const [type, count] of Object.entries(types)) {
                          detailHtml += `<li>${type}: ${count}</li>`;
                        }
                        detailHtml += "</ul>";
                      }

                      const detailDiv = document.getElementById(
                        `details-${props.station_id}`
                      );
                      if (detailDiv) {
                        detailDiv.innerHTML = detailHtml;
                      }
                    });
                });
              }

              // 📌 "Download CSV" button (only if logged in)
              if (isLoggedIn) {
                const dlBtn = document.getElementById(
                  `download-${props.station_id}`
                );
                if (dlBtn) {
                  dlBtn.addEventListener("click", async () => {
                    const detailUrl = `${GEOSERVER_OWS_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=crime_map_app:crime_records&outputFormat=application/json&CQL_FILTER=station_id=${props.station_id}`;

                    const res = await fetch(detailUrl);
                    const details = await res.json();

                    const rows = [
                      [
                        "Station ID",
                        "Police Station",
                        "District",
                        "Subdivision",
                        "Year",
                        "Crime Type",
                        "Crime Count",
                      ],
                    ];

                    details.features.forEach((f) => {
                      rows.push([
                        props.station_id,
                        props.police_station,
                        props.district,
                        props.subdivision || "",
                        f.properties.year,
                        f.properties.crime_type,
                        f.properties.crime_count,
                      ]);
                    });

                    const csvContent = rows
                      .map((r) =>
                        r
                          .map((val) =>
                            typeof val === "string" && val.includes(",")
                              ? `"${val}"`
                              : val
                          )
                          .join(",")
                      )
                      .join("\n");

                    const blob = new Blob([csvContent], {
                      type: "text/csv;charset=utf-8;",
                    });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = `station_${props.station_id}_crimes.csv`;
                    link.click();
                  });
                }
              }
            });
          },
        }).addTo(map);

        layerRef.current = geoJsonLayer;
      });

    return () => {
      isCancelled = true;
      try {
        if (layerRef.current) {
          map.removeLayer(layerRef.current);
          layerRef.current = null;
        }
      } catch {}
    };
  }, [map, enabled, isLoggedIn]);

  return (
    <div
      className="custom-layer-control"
      style={{ top: "340px" }}
      ref={toggleRef}
    >
      <button
        className={`custom-toggle-btn ${enabled ? "active" : ""}`}
        title="Toggle Crime Layer"
        onClick={() => setEnabled((p) => !p)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill={enabled ? "#EA4335" : "currentColor"}
        >
          <path d="M12 2l4 2 4-2v6c0 5.5-3.8 10.7-9 12-5.2-1.3-9-6.5-9-12V2l4 2 4-2z" />
        </svg>
      </button>
    </div>
  );
}

export default CrimeLayer;

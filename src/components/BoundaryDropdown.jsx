// src/components/BoundaryDropdown.jsx
import React, { useState, useRef, useEffect } from "react";
import { GeoJSON, WMSTileLayer, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import shp from "shpjs";
import { toWgs84 } from "@turf/projection";
import "../styles/map-controls.css";

import indiaBoundary from "/src/data/india_boundary.json";
import keralaBoundary from "/src/data/kerala_boundary.json";
// import ernakulamBoundary from "/src/data/ernakulam_boundary2.json";
// import kochiBoundary from "/src/data/kochi_boundary.json";

const boundaryOptions = {
  india: {
    name: "India",
    type: "geojson",
    data: indiaBoundary,
    color: "green",
  },
  kerala: {
    name: "Kerala",
    type: "geojson",
    data: keralaBoundary,
    color: "black",
  },
  // ernakulam: {
  //   name: "Ernakulam",
  //   type: "geojson",
  //   data: ernakulamBoundary,
  //   color: "red",
  // },
  // kochi: {
  //   name: "Kochi Admin",
  //   type: "geojson",
  //   data: kochiBoundary,
  //   color: "black",
  // },
};

function BoundaryDropdown() {
  const [visible, setVisible] = useState(false);
  const [activeLayers, setActiveLayers] = useState({
    kerala: true,
    kochi: true,
    kochi_labels: false,
  });

  // ✅ uploaded shapefiles
  const [uploadedLayers, setUploadedLayers] = useState([]);
  const fileInputRef = useRef(null);

  const controlRef = useRef(null);

  const toggleLayer = (key) => {
    setActiveLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFileSelect = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleShapefileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const geojson = await shp(arrayBuffer);

      let reprojected = geojson;
      if (
        geojson.crs?.properties?.name &&
        geojson.crs.properties.name !== "EPSG:4326"
      ) {
        reprojected = toWgs84(geojson);
      }

      setUploadedLayers((prev) => [
        ...prev,
        {
          id: Date.now(),
          name: file.name.replace(".zip", ""),
          data: reprojected,
          visible: true,
        },
      ]);

      // reset input so the same file can be re-uploaded
      event.target.value = "";
    } catch (err) {
      console.error("Error loading shapefile:", err);
    }
  };

  const removeUploadedLayer = (id) => {
    setUploadedLayers((prev) => prev.filter((layer) => layer.id !== id));
  };

  // ✅ prevent map clicks behind control
  useEffect(() => {
    if (controlRef.current) {
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  return (
    <div
      className="custom-layer-control"
      style={{ top: "240px" }}
      ref={controlRef}
    >
      {/* Toggle button styled like other controls */}
      <button
        className="custom-toggle-btn"
        title="Boundaries"
        onClick={() => setVisible((v) => !v)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 7l6-4 6 4 6-4v10l-6 4-6-4-6 4V7z" />
          <path d="M9 21V11m6 10V13" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {visible && (
        <div className="custom-dropdown">
          {/* Static boundaries */}
          {Object.entries(boundaryOptions).map(([key, option]) => (
            <div key={key}>
              <label className="custom-option">
                <input
                  type="checkbox"
                  checked={!!activeLayers[key]}
                  onChange={() => toggleLayer(key)}
                />
                <span>{option.name}</span>
              </label>

              {key === "kochi" && activeLayers.kochi && (
                <div className="ml-6">
                  <label className="custom-option">
                    <input
                      type="checkbox"
                      checked={!!activeLayers.kochi_labels}
                      onChange={() => toggleLayer("kochi_labels")}
                    />
                    <span>Show Labels</span>
                  </label>
                </div>
              )}
            </div>
          ))}

          {/* Uploaded layers with remove (X) */}
          {uploadedLayers.map((layer) => (
            <div
              key={layer.id}
              className="custom-option flex justify-between items-center"
            >
              <label>
                <input
                  type="checkbox"
                  checked={layer.visible}
                  onChange={() =>
                    setUploadedLayers((prev) =>
                      prev.map((l) =>
                        l.id === layer.id ? { ...l, visible: !l.visible } : l
                      )
                    )
                  }
                />
                <span className="ml-2">{layer.name}</span>
              </label>
              <button
                onClick={() => removeUploadedLayer(layer.id)}
                style={{ marginLeft: "8px", color: "red", fontWeight: "bold" }}
              >
                ✕
              </button>
            </div>
          ))}

          {/* Add button */}
          <div className="custom-option mt-2">
            <button
              className="text-blue-600 font-semibold"
              onClick={handleFileSelect}
            >
              + Add Layer
            </button>
            <input
              type="file"
              accept=".zip"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleShapefileUpload}
            />
          </div>
        </div>
      )}

      {/* Render static boundaries */}
      {Object.entries(boundaryOptions).map(([key, option]) => {
        if (!activeLayers[key]) return null;
        if (option.type === "geojson") {
          return (
            <GeoJSON
              key={key}
              data={option.data}
              style={{ color: option.color, weight: 2, fillOpacity: 0 }}
              pointToLayer={() => null}
              interactive={false}
            />
          );
        }
        if (option.type === "wms") {
          return (
            <WMSTileLayer
              key={key}
              url={option.url}
              layers={option.layers}
              format={option.format}
              transparent={option.transparent}
              styles={option.styles}
            />
          );
        }
        return null;
      })}

      {/* Render uploaded shapefiles */}
      {uploadedLayers.map(
        (layer) =>
          layer.visible && (
            <GeoJSON
              key={`upload-${layer.id}`}
              data={layer.data}
              style={{ color: "black", weight: 2, fillOpacity: 0 }}
            />
          )
      )}

      {/* Kochi Police Labels */}
      {activeLayers.kochi &&
        activeLayers.kochi_labels &&
        kochiBoundary.features.map((feature, i) => {
          const lat = feature.properties.Lat_t;
          const lng = feature.properties.Long_t;
          if (!lat || !lng) return null;
          return (
            <Marker
              key={`label-${i}`}
              position={[lat, lng]}
              icon={L.divIcon({ className: "invisible-marker" })}
              interactive={false}
            >
              <Tooltip permanent direction="top">
                {feature.properties.POLICE_STA}
              </Tooltip>
            </Marker>
          );
        })}
    </div>
  );
}

export default BoundaryDropdown;

// src/components/MapLayersToggle.jsx
import React, { useState, useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/map-controls.css";

export const baseLayers = {
  roadmap: {
    name: "Roadmap",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors & Carto",
  },
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

const buildBaseLayer = (config) => {
  if (config.type === "wms") {
    return L.tileLayer.wms(config.url, {
      layers: config.layers,
      format: config.format || "image/png",
      transparent: Boolean(config.transparent),
      version: config.version || "1.1.1",
      attribution: config.attribution,
    });
  }

  return L.tileLayer(config.url, {
    attribution: config.attribution,
  });
};

function MapLayersToggle({ activeBase, setActiveBase }) {
  const [open, setOpen] = useState(false);
  const map = useMap();
  const controlRef = useRef(null);
  const baseLayerRef = useRef(null);
  const primaryThumbs = ["osm", "satellite", "topo"];
  const extraThumbs = ["roadmap", "dark"];

  // ✅ Ensure base layer is always on map
  useEffect(() => {
    if (!map) return;
    const selected = baseLayers[activeBase];
    if (!selected) return;

    try {
      if (baseLayerRef.current && map.hasLayer(baseLayerRef.current)) {
        map.removeLayer(baseLayerRef.current);
      }
    } catch {}

    const nextBase = buildBaseLayer(selected).addTo(map);
    baseLayerRef.current = nextBase;

    return () => {
      try {
        if (baseLayerRef.current && map.hasLayer(baseLayerRef.current)) {
          map.removeLayer(baseLayerRef.current);
        }
      } catch {}
      baseLayerRef.current = null;
    };
  }, [map, activeBase]);

  // ✅ Block clicks & scrolls from leaking through
  useEffect(() => {
    if (controlRef.current) {
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  return (
    <div
      className="custom-layer-control"
      style={{ top: "auto", bottom: "20px", right: "12px" }}
      ref={controlRef}
    >
      <div
        className={`layer-switcher-bar ${open ? "expanded" : ""}`}
        title="Map Layers"
      >
        <div className="layer-thumbs">
          {primaryThumbs.map((key) => (
            <button
              key={key}
              type="button"
              className={`layer-thumb-btn ${activeBase === key ? "active" : ""}`}
              onClick={() => setActiveBase(key)}
              title={baseLayers[key].name}
            >
              <span className={`layer-thumb layer-thumb-${key}`} />
            </button>
          ))}
        </div>
        <div className="layer-thumbs-extra">
          {extraThumbs.map((key) => (
            <button
              key={key}
              type="button"
              className={`layer-thumb-btn ${activeBase === key ? "active" : ""}`}
              onClick={() => setActiveBase(key)}
              title={baseLayers[key].name}
            >
              <span className={`layer-thumb layer-thumb-${key}`} />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="layer-chev-btn"
          onClick={() => setOpen((v) => !v)}
          title="More map layers"
        >
          {open ? "›" : "‹"}
        </button>
      </div>
    </div>
  );
}

export default MapLayersToggle;

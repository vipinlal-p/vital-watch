import React, { useState, useRef, useEffect, useMemo } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import shp from "shpjs";
import proj4 from "proj4";
import "../styles/map-controls.css";
import "../styles/layer-panels.css";

const vectorJsonModules = import.meta.glob("/src/data/**/*.json", {
  eager: true,
});
const vectorGeoJsonRawModules = import.meta.glob("/src/data/**/*.geojson", {
  eager: true,
  import: "default",
  query: "?raw",
});
const vectorFileModules = { ...vectorJsonModules, ...vectorGeoJsonRawModules };
const VECTOR_COLORS = [
  "#9a3412",
  "#6d28d9",
  "#0369a1",
  "#dc2626",
  "#0f766e",
  "#a16207",
  "#4338ca",
  "#be185d",
];

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildAttributesHtml = (properties = {}) => {
  const entries = Object.entries(properties).filter(
    ([, value]) => value !== null && value !== undefined && String(value).trim() !== ""
  );

  if (entries.length === 0) {
    return '<div style="font-size:12px;"><b>Attributes</b><br/>No attributes</div>';
  }

  const rows = entries
    .slice(0, 20)
    .map(
      ([key, value]) =>
        `<div><b>${escapeHtml(key)}:</b> ${escapeHtml(value)}</div>`
    )
    .join("");

  return `<div style="max-width:260px;max-height:220px;overflow:auto;font-size:12px;line-height:1.35;"><b>Attributes</b><hr style="margin:4px 0;"/>${rows}</div>`;
};

const isGeoJsonLike = (obj) => {
  if (!obj || typeof obj !== "object") return false;
  if (obj.type === "FeatureCollection" || obj.type === "Feature") return true;
  if (obj.type && obj.coordinates) return true;
  return false;
};

const parseJsonText = (text, fileName = "file") => {
  try {
    const normalized = String(text ?? "").replace(/^\uFEFF/, "").trim();
    return JSON.parse(normalized);
  } catch (err) {
    throw new Error(
      `Invalid JSON in ${fileName}. ${err instanceof Error ? err.message : "Parse failed."}`
    );
  }
};

const toTitle = (id) =>
  id
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

const normalizeFeatureCollection = (obj) => {
  if (!obj) return null;
  if (obj.type === "FeatureCollection") return obj;
  if (obj.type === "Feature") return { type: "FeatureCollection", features: [obj] };
  if (Array.isArray(obj)) {
    if (obj.every((item) => item?.type === "FeatureCollection")) {
      return {
        type: "FeatureCollection",
        features: obj.flatMap((item) => item.features || []),
      };
    }
    if (obj.every((item) => item?.type === "Feature")) {
      return { type: "FeatureCollection", features: obj };
    }
    return obj;
  }
  if (obj.type && obj.coordinates) {
    return {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: obj }],
    };
  }
  return obj;
};

const sampleCoords = (fc, limit = 20) => {
  try {
    const out = [];
    const collectFromGeom = (g) => {
      if (!g || out.length >= limit) return;
      if (g.type === "GeometryCollection") {
        (g.geometries || []).forEach(collectFromGeom);
        return;
      }
      const coords = g.coordinates;
      if (!coords) return;
      const walk = (node) => {
        if (!Array.isArray(node) || out.length >= limit) return;
        if (
          node.length >= 2 &&
          typeof node[0] === "number" &&
          typeof node[1] === "number"
        ) {
          out.push([node[0], node[1]]);
          return;
        }
        node.forEach(walk);
      };
      walk(coords);
    };

    if (fc?.type === "FeatureCollection") {
      (fc.features || []).forEach((f) => collectFromGeom(f.geometry));
    } else if (fc?.type === "Feature") {
      collectFromGeom(fc.geometry);
    } else {
      collectFromGeom(fc);
    }
    return out;
  } catch {
    return [];
  }
};

const isLonLatCoord = (coord) => {
  if (!coord || coord.length < 2) return false;
  const [x, y] = coord;
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Math.abs(x) <= 180 &&
    Math.abs(y) <= 90
  );
};

const isLikelyWebMercatorCoord = (coord) => {
  if (!coord || coord.length < 2) return false;
  const [x, y] = coord.map((v) => Math.abs(Number(v)));
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x <= 20037508.35 &&
    y <= 20037508.35 &&
    (x > 180 || y > 90)
  );
};

const isLikelyUtmCoord = (coord) => {
  if (!coord || coord.length < 2) return false;
  const [x, y] = coord.map((v) => Number(v));
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 100000 &&
    x <= 900000 &&
    y >= 0 &&
    y <= 10000000
  );
};

const traverseAndTransform = (obj, transformFn) => {
  if (!obj) return obj;
  const t = (g) => {
    if (!g) return g;
    const { type, coordinates } = g;
    if (type === "Point") return { ...g, coordinates: transformFn(coordinates) };
    if (type === "MultiPoint" || type === "LineString") {
      return { ...g, coordinates: coordinates.map(transformFn) };
    }
    if (type === "MultiLineString" || type === "Polygon") {
      return { ...g, coordinates: coordinates.map((r) => r.map(transformFn)) };
    }
    if (type === "MultiPolygon") {
      return {
        ...g,
        coordinates: coordinates.map((p) => p.map((r) => r.map(transformFn))),
      };
    }
    if (type === "GeometryCollection") {
      return { ...g, geometries: g.geometries.map(t) };
    }
    return g;
  };

  if (obj.type === "FeatureCollection") {
    return {
      ...obj,
      features: obj.features.map((f) => ({ ...f, geometry: t(f.geometry) })),
    };
  }
  if (obj.type === "Feature") {
    return { ...obj, geometry: t(obj.geometry) };
  }
  return t(obj);
};

const getCrsName = (obj) => {
  const name = obj?.crs?.properties?.name;
  return typeof name === "string" ? name.toUpperCase().trim() : null;
};

const toEpsgCode = (name) => {
  if (!name) return null;
  const match =
    name.match(/EPSG[:/]+(\d{3,6})/i) ||
    name.match(/URN:OGC:DEF:CRS:EPSG::(\d{3,6})/i) ||
    name.match(/^(\d{3,6})$/);
  return match ? `EPSG:${match[1]}` : null;
};

const ensureUtmProjectionDef = (epsgCode) => {
  if (!epsgCode || typeof epsgCode !== "string") return;
  if (proj4.defs(epsgCode)) return;
  const match = epsgCode.match(/^EPSG:(326|327)(\d{2})$/i);
  if (!match) return;
  const hemisphere = match[1];
  const zone = Number(match[2]);
  if (!Number.isInteger(zone) || zone < 1 || zone > 60) return;
  const isSouth = hemisphere === "327";
  const def = `+proj=utm +zone=${zone} ${isSouth ? "+south " : ""}+datum=WGS84 +units=m +no_defs`;
  proj4.defs(epsgCode, def);
};

const inferUtmEpsg = (samples, mapCenter = null) => {
  if (!samples.length) return null;
  const utmCount = samples.filter(isLikelyUtmCoord).length;
  if (utmCount < Math.ceil(samples.length * 0.7)) return null;

  const centerLng =
    mapCenter && Number.isFinite(mapCenter.lng) ? mapCenter.lng : 77;
  const centerLat =
    mapCenter && Number.isFinite(mapCenter.lat) ? mapCenter.lat : 10;

  const zone = Math.min(60, Math.max(1, Math.floor((centerLng + 180) / 6) + 1));
  const hemisphereCode = centerLat < 0 ? "327" : "326";
  return `EPSG:${hemisphereCode}${String(zone).padStart(2, "0")}`;
};

const inferSourceCrs = (obj, mapCenter = null) => {
  const declared = toEpsgCode(getCrsName(obj));
  if (declared) return declared;

  const samples = sampleCoords(obj, 20);
  if (samples.length === 0) return null;
  const lonLatCount = samples.filter(isLonLatCoord).length;
  const mercatorCount = samples.filter(isLikelyWebMercatorCoord).length;

  if (lonLatCount === samples.length) return "EPSG:4326";
  if (mercatorCount >= Math.ceil(samples.length * 0.7)) return "EPSG:3857";
  return inferUtmEpsg(samples, mapCenter);
};

const reprojectToWgs84 = (inputGeoJson, mapCenter = null) => {
  let normalized = normalizeFeatureCollection(inputGeoJson);
  const sourceCrs = inferSourceCrs(normalized, mapCenter);

  if (sourceCrs && sourceCrs !== "EPSG:4326") {
    try {
      ensureUtmProjectionDef(sourceCrs);
      normalized = traverseAndTransform(normalized, (c) =>
        proj4(sourceCrs, "EPSG:4326", c)
      );
      return { data: normalized, sourceCrs, reprojected: true };
    } catch (error) {
      console.warn(
        `Could not reproject from ${sourceCrs}. Rendering without transform.`,
        error
      );
    }
  }

  return { data: normalized, sourceCrs, reprojected: false };
};

function VectorLayers({
  hideToggle = false,
  externallyOpen,
  containerStyle,
  onLegendChange,
  onRequestClose,
}) {
  const map = useMap();
  const [visibleLocal, setVisibleLocal] = useState(false);
  const [activeLayers, setActiveLayers] = useState({});

  const [uploadedLayers, setUploadedLayers] = useState([]);
  const fileInputRef = useRef(null);
  const controlRef = useRef(null);
  const lastLegendPayloadRef = useRef("");

  const vectorOptions = useMemo(
    () =>
      Object.entries(vectorFileModules)
        .map(([filePath, mod], idx) => {
          const modValue = mod?.default ?? mod;
          const data =
            typeof modValue === "string"
              ? parseJsonText(modValue, filePath)
              : modValue;
          if (!isGeoJsonLike(data)) return null;
          const base = filePath.split("/").pop() || "";
          const id = base.replace(/\.(json|geojson)$/i, "");
          const reprojection = reprojectToWgs84(data, map.getCenter());
          if (reprojection.reprojected) {
            console.info(
              `Reprojected local layer ${id}: ${reprojection.sourceCrs} -> EPSG:4326`
            );
          }
          return {
            id,
            name: toTitle(id),
            data: reprojection.data,
            color: VECTOR_COLORS[idx % VECTOR_COLORS.length],
            isHospital: id.toLowerCase().includes("hospital"),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [map]
  );

  useEffect(() => {
    setActiveLayers((prev) => {
      const next = {};
      vectorOptions.forEach((option) => {
        next[option.id] = prev[option.id] ?? false;
      });
      const changed =
        Object.keys(next).length !== Object.keys(prev).length ||
        Object.entries(next).some(([k, v]) => prev[k] !== v);
      return changed ? next : prev;
    });
  }, [vectorOptions]);

  const toggleLayer = (key) => {
    setActiveLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFileSelect = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const name = file.name.toLowerCase();
      let geojson = null;

      if (name.endsWith(".zip")) {
        const arrayBuffer = await file.arrayBuffer();
        const parsed = await shp(arrayBuffer);

        // shpjs may return an object of named layers. Merge all features so
        // points/lines/polygons from different layers are all visible.
        if (
          parsed &&
          parsed.type === undefined &&
          !Array.isArray(parsed) &&
          typeof parsed === "object"
        ) {
          const mergedFeatures = Object.values(parsed).flatMap((layer) => {
            if (!layer) return [];
            if (layer.type === "FeatureCollection" && Array.isArray(layer.features)) {
              return layer.features;
            }
            if (layer.type === "Feature") return [layer];
            if (Array.isArray(layer)) return layer;
            return [];
          });
          geojson = { type: "FeatureCollection", features: mergedFeatures };
        } else {
          geojson = parsed;
        }
      } else if (name.endsWith(".geojson") || name.endsWith(".json")) {
        const text = await file.text();
        const parsed = parseJsonText(text, file.name);
        // normalize single Feature to FeatureCollection
        if (parsed && parsed.type === "Feature") {
          geojson = { type: "FeatureCollection", features: [parsed] };
        } else {
          geojson = parsed;
        }
      } else {
        console.warn("Unsupported file type:", file.name);
        event.target.value = "";
        return;
      }

      const reprojection = reprojectToWgs84(geojson, map.getCenter());
      let normalized = reprojection.data;
      if (reprojection.reprojected) {
        console.info(
          `Reprojected uploaded layer ${reprojection.sourceCrs} -> EPSG:4326`
        );
      } else if (!reprojection.sourceCrs) {
        console.warn(
          "Could not infer upload CRS. If layer appears off-map, provide EPSG metadata."
        );
      }

      const layerId = Date.now();

      // log some diagnostics
      try {
        const temp = L.geoJSON(normalized);
        const bounds = temp.getBounds();
        console.info("Uploaded layer:", file.name, {
          features: normalized?.features?.length ?? 0,
          bounds: bounds.isValid() ? bounds.toBBoxString() : null,
        });
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.15));
        }
      } catch (e) {
        console.warn("Could not compute bounds for uploaded layer", e);
      }

      setUploadedLayers((prev) => [
        ...prev,
        {
          id: layerId,
          name: file.name.replace(/\.(zip|geojson|json)$/i, ""),
          data: normalized,
          visible: true,
        },
      ]);
      event.target.value = "";
    } catch (err) {
      console.error("Error loading file:", err);
      alert(err instanceof Error ? err.message : "Error loading file.");
    }
  };

  const removeUploadedLayer = (id) => {
    setUploadedLayers((prev) => prev.filter((layer) => layer.id !== id));
  };

  const handleFeatureHover = (feature, layer) => {
    const html = buildAttributesHtml(feature?.properties || {});
    layer.bindTooltip(html, {
      sticky: true,
      direction: "top",
      opacity: 0.95,
      className: "boundary-attr-tooltip",
    });
  };

  const hospitalHIcon = L.divIcon({
    className: "",
    html:
      '<div style="width:20px;height:20px;border-radius:50%;background:#dc2626;color:#fff;border:1px solid #fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;line-height:1;">H</div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  useEffect(() => {
    if (controlRef.current) {
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  const visible =
    typeof externallyOpen === "boolean" ? externallyOpen : visibleLocal;
  const closePanel = () => {
    if (onRequestClose) {
      onRequestClose();
      return;
    }
    setVisibleLocal(false);
  };

  useEffect(() => {
    const legendItems = [
      ...vectorOptions
        .filter((option) => Boolean(activeLayers[option.id]))
        .map((option) => ({
          id: option.id,
          name: option.name,
          color: option.color,
        })),
      ...uploadedLayers
        .filter((layer) => layer.visible)
        .map((layer) => ({
          id: String(layer.id),
          name: layer.name,
          color: "#ff7800",
        })),
    ];
    const payload = JSON.stringify(legendItems);
    if (payload === lastLegendPayloadRef.current) return;
    lastLegendPayloadRef.current = payload;
    onLegendChange?.(legendItems);
  }, [activeLayers, uploadedLayers, vectorOptions, onLegendChange]);

  return (
    <div
      className="layer-panel-control"
      style={containerStyle || { top: "132px", left: "12px", width: "270px" }}
      ref={controlRef}
    >
      {/* Toggle Button */}
      {!hideToggle && (
        <button
          className="layer-panel-btn"
          title="Vector Layers"
          onClick={() => setVisibleLocal((v) => !v)}
        >
          Vector Layers
        </button>
      )}

      {/* Dropdown */}
      {visible && (
        <div className="layer-panel-form raster-panel">
          <div className="layer-panel-header">
            <div className="layer-panel-title">Vector Layers</div>
            <button
              type="button"
              className="layer-panel-close-btn"
              title="Close"
              onClick={closePanel}
            >
              ×
            </button>
          </div>
          <div className="raster-meta">Source: Local GeoJSON/Shapefile</div>

          <div className="raster-list">
            {vectorOptions.map((option) => (
              <label key={option.id} className="raster-checkbox">
                <input
                  type="checkbox"
                  checked={!!activeLayers[option.id]}
                  onChange={() => toggleLayer(option.id)}
                />
                <span className="raster-label-wrap">
                  <span className="raster-layer-title">{option.name}</span>
                  <span className="raster-layer-name">{option.id}</span>
                </span>
              </label>
            ))}

            {uploadedLayers.map((layer) => (
              <div key={layer.id} className="raster-checkbox">
                <label className="raster-label-wrap" style={{ width: "100%" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                    <span className="raster-layer-title">{layer.name}</span>
                  </span>
                  <button
                    type="button"
                    className="raster-local-remove"
                    onClick={() => removeUploadedLayer(layer.id)}
                    style={{ marginLeft: 0 }}
                  >
                    x
                  </button>
                </label>
              </div>
            ))}
          </div>

          <div className="raster-manual-add">
            <button type="button" onClick={handleFileSelect}>
              + Add Layer
            </button>
            <input
              type="file"
              accept=".zip,.geojson,.json"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
          </div>

        </div>
      )}

      {/* Static Boundaries */}
      {vectorOptions.map((option) => {
        if (!activeLayers[option.id]) return null;
        return (
          <GeoJSON
            key={option.id}
            data={option.data}
            style={{
              color: option.color,
              weight: 2,
              fillColor: option.color,
              fillOpacity: 0.1,
            }}
            pointToLayer={(feature, latlng) =>
              option.isHospital
                ? L.marker(latlng, { icon: hospitalHIcon })
                : L.circleMarker(latlng, {
                    radius: 6,
                    fillColor: option.color,
                    color: "#ffffff",
                    weight: 1,
                    fillOpacity: 0.9,
                  })
            }
            onEachFeature={handleFeatureHover}
          />
        );
      })}

      {/* Uploaded GeoJSON */}
      {uploadedLayers.map(
        (layer) =>
          layer.visible && (
            <GeoJSON
              key={`upload-${layer.id}`}
              data={layer.data}
              style={{ color: "#ff7800", weight: 2, fillOpacity: 0.2 }}
              pointToLayer={(feature, latlng) =>
                L.circleMarker(latlng, { radius: 6, fillColor: "#ff7800", color: "#fff", weight: 1, fillOpacity: 0.9 })
              }
              onEachFeature={handleFeatureHover}
            />
          )
      )}
    </div>
  );
}

export default VectorLayers;

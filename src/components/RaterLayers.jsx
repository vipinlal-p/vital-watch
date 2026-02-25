// src/components/RaterLayers.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { GEOSERVER_WMS_URL } from "/src/config/endpoints";
import "../styles/add-crime-data.css";

const WMS_URL = GEOSERVER_WMS_URL;
const GEOSERVER_WORKSPACE =
  (import.meta.env.VITE_GEOSERVER_WORKSPACE || "raster").trim();

const DEFAULT_LAYER_NAMES = [
  import.meta.env.VITE_GEOSERVER_DEM_LAYER || "raster:dem",
  import.meta.env.VITE_GEOSERVER_ASPECT_LAYER || "raster:aspect",
  import.meta.env.VITE_GEOSERVER_POPULATION_LAYER || "raster:population_density",
];

const normalizeEpsg = (crsText) => {
  if (!crsText || typeof crsText !== "string") return null;
  const match = crsText.trim().toUpperCase().match(/EPSG[:/](\d{3,6})/);
  return match ? `EPSG:${match[1]}` : null;
};

const parseCapabilities = (xmlText) => {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const rootLayer =
    xml.querySelector("Capability > Layer") ||
    xml.querySelector("WMS_Capabilities > Capability > Layer") ||
    xml.querySelector("WMT_MS_Capabilities > Capability > Layer");

  if (!rootLayer) return [];

  const collected = [];
  const walkLayer = (layerNode, inheritedCrs = []) => {
    const directCrsNodes = [
      ...layerNode.querySelectorAll(":scope > CRS"),
      ...layerNode.querySelectorAll(":scope > SRS"),
    ];

    const currentCrs = [
      ...new Set([
        ...inheritedCrs,
        ...directCrsNodes
          .map((node) => normalizeEpsg(node.textContent || ""))
          .filter(Boolean),
      ]),
    ];

    const name = layerNode.querySelector(":scope > Name")?.textContent?.trim();
    const title =
      layerNode.querySelector(":scope > Title")?.textContent?.trim() || name;

    if (name) {
      collected.push({ id: name, name, title, supportedCrs: currentCrs });
    }

    layerNode.querySelectorAll(":scope > Layer").forEach((child) => {
      walkLayer(child, currentCrs);
    });
  };

  walkLayer(rootLayer, []);

  const deduped = new Map();
  for (const layer of collected) {
    if (!deduped.has(layer.name)) {
      deduped.set(layer.name, layer);
      continue;
    }
    const prev = deduped.get(layer.name);
    deduped.set(layer.name, {
      ...prev,
      supportedCrs: [
        ...new Set([...(prev.supportedCrs || []), ...(layer.supportedCrs || [])]),
      ],
    });
  }

  return [...deduped.values()];
};

const getPreferredCrs = (mapCrs, supportedCrs = []) => {
  const normalizedMapCrs = normalizeEpsg(mapCrs) || "EPSG:3857";
  if (supportedCrs.length === 0) return normalizedMapCrs;
  if (supportedCrs.includes(normalizedMapCrs)) return normalizedMapCrs;
  if (supportedCrs.includes("EPSG:3857")) return "EPSG:3857";
  if (supportedCrs.includes("EPSG:4326")) return "EPSG:4326";
  return null;
};

export default function RaterLayers({
  hideToggle = false,
  externallyOpen,
  containerStyle,
  onLegendChange,
}) {
  const map = useMap();
  const controlRef = useRef(null);
  const wmsLayersRef = useRef({});

  const [isOpenLocal, setIsOpenLocal] = useState(false);
  const [opacity, setOpacity] = useState(0.65);
  const [catalogLayers, setCatalogLayers] = useState([]);
  const [activeLayers, setActiveLayers] = useState({});
  const [filterText, setFilterText] = useState("");
  const [customLayerName, setCustomLayerName] = useState("");
  const [catalogStatus, setCatalogStatus] = useState({
    loading: false,
    error: "",
    info: "",
  });

  const mapCrs = useMemo(
    () => normalizeEpsg(map?.options?.crs?.code) || "EPSG:3857",
    [map]
  );

  useEffect(() => {
    const el = controlRef.current;
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchCapabilities = async () => {
      setCatalogStatus((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const url = `${WMS_URL}?service=WMS&request=GetCapabilities`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`GetCapabilities failed (${res.status})`);

        const xmlText = await res.text();
        const parsed = parseCapabilities(xmlText);
        if (cancelled) return;

        const workspacePrefix = `${GEOSERVER_WORKSPACE}:`;
        const filteredByWorkspace = parsed.filter((layer) =>
          layer.name?.startsWith(workspacePrefix)
        );
        const sorted = filteredByWorkspace.sort((a, b) =>
          (a.title || a.name).localeCompare(b.title || b.name)
        );

        setCatalogLayers(sorted);

        const defaultsFound = DEFAULT_LAYER_NAMES.filter((name) =>
          sorted.some((layer) => layer.name === name)
        );

        setActiveLayers((prev) => {
          const next = { ...prev };
          defaultsFound.forEach((name) => {
            if (next[name] === undefined) next[name] = false;
          });
          return next;
        });

        setCatalogStatus((prev) => ({
          ...prev,
          loading: false,
          error: "",
          info:
            sorted.length > 0
              ? `Loaded ${sorted.length} raster layer(s) from workspace ${GEOSERVER_WORKSPACE}.`
              : `No raster layers found in workspace ${GEOSERVER_WORKSPACE}.`,
        }));
      } catch (err) {
        if (cancelled) return;
        console.error("WMS capabilities load failed:", err);
        setCatalogStatus((prev) => ({
          ...prev,
          loading: false,
          error: "Could not load layer catalog.",
        }));
      }
    };

    fetchCapabilities();
    return () => {
      cancelled = true;
    };
  }, []);

  const allLayers = useMemo(() => {
    const catalogByName = new Map(catalogLayers.map((layer) => [layer.name, layer]));

    const defaults = DEFAULT_LAYER_NAMES.map((name) => {
      const fromCatalog = catalogByName.get(name);
      if (fromCatalog) return fromCatalog;
      return {
        id: name,
        name,
        title: name,
        supportedCrs: [],
      };
    });

    const manualOnly = Object.keys(activeLayers)
      .filter((name) => !catalogByName.has(name) && !DEFAULT_LAYER_NAMES.includes(name))
      .map((name) => ({
        id: name,
        name,
        title: `${name} (manual)`,
        supportedCrs: [],
      }));

    const merged = new Map();
    [...defaults, ...catalogLayers, ...manualOnly].forEach((layer) => {
      if (!layer?.name) return;
      merged.set(layer.name, layer);
    });

    return [...merged.values()];
  }, [activeLayers, catalogLayers]);

  const filteredLayers = useMemo(() => {
    const search = filterText.trim().toLowerCase();
    if (!search) return allLayers;
    return allLayers.filter((layer) => {
      const label = `${layer.title || ""} ${layer.name || ""}`.toLowerCase();
      return label.includes(search);
    });
  }, [allLayers, filterText]);

  const enabledLayerNames = useMemo(
    () => Object.keys(activeLayers).filter((name) => Boolean(activeLayers[name])),
    [activeLayers]
  );

  useEffect(() => {
    const legendItems = enabledLayerNames.map((layerName) => ({
      id: layerName,
      name: layerName,
      imageUrl: `${WMS_URL}?service=WMS&request=GetLegendGraphic&format=image/png&layer=${encodeURIComponent(
        layerName
      )}`,
    }));
    onLegendChange?.(legendItems);
  }, [enabledLayerNames, onLegendChange]);

  useEffect(() => {
    Object.entries(activeLayers).forEach(([layerName, isEnabled]) => {
      const existingLayer = wmsLayersRef.current[layerName] || null;
      const layerConfig = allLayers.find((layer) => layer.name === layerName) || {
        name: layerName,
        title: layerName,
        supportedCrs: [],
      };

      if (!isEnabled && existingLayer) {
        try {
          map.removeLayer(existingLayer.leafletLayer);
        } catch {}
        delete wmsLayersRef.current[layerName];
        return;
      }

      if (!isEnabled || existingLayer) return;

      const preferredCrs = getPreferredCrs(mapCrs, layerConfig.supportedCrs);
      if (!preferredCrs) {
        setCatalogStatus((prev) => ({
          ...prev,
          error: `Layer ${layerName} does not support ${mapCrs} / EPSG:3857 / EPSG:4326.`,
        }));
        setActiveLayers((prev) => ({ ...prev, [layerName]: false }));
        return;
      }

      const wmsLayer = L.tileLayer.wms(WMS_URL, {
        layers: layerName,
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        srs: preferredCrs,
        attribution: "GeoServer",
        opacity,
      });

      wmsLayer.addTo(map);
      wmsLayersRef.current[layerName] = {
        leafletLayer: wmsLayer,
        srs: preferredCrs,
      };
    });
  }, [activeLayers, allLayers, map, mapCrs, opacity]);

  useEffect(() => {
    Object.values(wmsLayersRef.current).forEach((entry) => {
      try {
        entry.leafletLayer.setOpacity(opacity);
      } catch {}
    });
  }, [opacity]);

  useEffect(() => {
    return () => {
      Object.values(wmsLayersRef.current).forEach((entry) => {
        try {
          if (map.hasLayer(entry.leafletLayer)) {
            map.removeLayer(entry.leafletLayer);
          }
        } catch {}
      });
      wmsLayersRef.current = {};
    };
  }, [map]);

  const isOpen =
    typeof externallyOpen === "boolean" ? externallyOpen : isOpenLocal;

  const toggleLayer = (layerName) => {
    setCatalogStatus((prev) => ({ ...prev, error: "" }));
    setActiveLayers((prev) => ({ ...prev, [layerName]: !prev[layerName] }));
  };

  const addCustomLayer = () => {
    const trimmed = customLayerName.trim();
    if (!trimmed) return;
    setActiveLayers((prev) => {
      if (Object.prototype.hasOwnProperty.call(prev, trimmed)) return prev;
      return { ...prev, [trimmed]: false };
    });
    setCustomLayerName("");
  };

  return (
    <div className="add-crime-control" ref={controlRef} style={containerStyle}>
      {!hideToggle && (
        <button
          className="add-crime-btn"
          title="Raster Layers"
          onClick={() => setIsOpenLocal((value) => !value)}
        >
          Raster Layers
        </button>
      )}

      {isOpen && (
        <div className="add-crime-form raster-panel">
          <div className="raster-meta">Source: GeoServer WMS</div>
          <div className="raster-meta">Map CRS: {mapCrs}</div>

          <input
            className="raster-search"
            type="text"
            placeholder="Search raster layers..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />

          <div className="raster-list">
            {filteredLayers.map((layer) => {
              const crsLabel =
                layer.supportedCrs && layer.supportedCrs.length > 0
                  ? layer.supportedCrs.slice(0, 3).join(", ")
                  : "CRS unknown";
              return (
                <label key={layer.name} className="raster-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(activeLayers[layer.name])}
                    onChange={() => toggleLayer(layer.name)}
                  />
                  <span className="raster-label-wrap">
                    <span className="raster-layer-title">{layer.title || layer.name}</span>
                    <span className="raster-layer-name">{layer.name}</span>
                    <span className="raster-layer-crs">{crsLabel}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="raster-manual-add">
            <input
              type="text"
              placeholder="workspace:layer"
              value={customLayerName}
              onChange={(e) => setCustomLayerName(e.target.value)}
            />
            <button type="button" onClick={addCustomLayer}>
              Add WMS
            </button>
          </div>

          <label className="raster-opacity-label">
            Opacity: {Math.round(opacity * 100)}%
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </label>

          {catalogStatus.loading && (
            <div className="raster-status">Loading layer catalog...</div>
          )}
          {catalogStatus.info && !catalogStatus.loading && (
            <div className="raster-status">{catalogStatus.info}</div>
          )}
          {catalogStatus.error && (
            <div className="raster-status raster-status-error">{catalogStatus.error}</div>
          )}

          <div className="raster-meta raster-meta-url" title={WMS_URL}>
            {WMS_URL}
          </div>
        </div>
      )}
    </div>
  );
}

// src/components/MeasureControl.jsx
import React, { useState, useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "../styles/map-controls.css";

export default function MeasureControl() {
    const map = useMap();
    const [enabled, setEnabled] = useState(false);
    const [activeTool, setActiveTool] = useState(null);
    const [drawing, setDrawing] = useState(false);

    // refs
    const measureGroupRef = useRef(null);
    const workingLayerRef = useRef(null);
    const edgeLabelsRef = useRef(new WeakMap());
    const manualFinalizeRef = useRef(false);
    const activeToolRef = useRef(activeTool);
    const workingClickHandlerRef = useRef(null);
    const dblClickHandlerRef = useRef(null);
    const toggleRef = useRef(null);

    // keep ref in sync with activeTool (used inside event handlers)
    useEffect(() => {
        activeToolRef.current = activeTool;
    }, [activeTool]);

    // ✅ prevent toggle button clicks/scrolls from reaching the map
    useEffect(() => {
        if (toggleRef.current) {
            L.DomEvent.disableClickPropagation(toggleRef.current);
            L.DomEvent.disableScrollPropagation(toggleRef.current);
        }
    }, []);


    // helpers
    const fmtDist = (m) => (m < 1000 ? `${m.toFixed(1)} m` : `${(m / 1000).toFixed(3).replace(/\.?0+$/, "")} km`);
    const fmtArea = (m2) => (m2 < 1000000 ? `${m2.toFixed(0)} m²` : `${(m2 / 1000000).toFixed(2)} km²`);
    const safeDisablePmModes = () => {
        if (!map?.pm) return;
        try {
            if (map.pm.globalDrawModeEnabled?.()) {
                map.pm.disableDraw();
            }
        } catch (e) { }
        try {
            if (map.pm.globalEditModeEnabled?.()) {
                map.pm.disableGlobalEditMode();
            }
        } catch (e) { }
        try {
            if (map.pm.globalRemovalModeEnabled?.()) {
                map.pm.disableGlobalRemovalMode();
            }
        } catch (e) { }
        try {
            if (map.pm.globalDragModeEnabled?.()) {
                map.pm.disableGlobalDragMode();
            }
        } catch (e) { }
    };

    // Geodesic area (fallback implementation)
    const geodesicArea = (latlngs) => {
        if (!latlngs || latlngs.length < 3) return 0;
        const R = 6378137; // meters (WGS84)
        let area = 0;
        for (let i = 0, len = latlngs.length, j = len - 1; i < len; j = i++) {
            const lat1 = (latlngs[j].lat * Math.PI) / 180;
            const lon1 = (latlngs[j].lng * Math.PI) / 180;
            const lat2 = (latlngs[i].lat * Math.PI) / 180;
            const lon2 = (latlngs[i].lng * Math.PI) / 180;
            area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
        }
        return Math.abs((area * R * R) / 2.0);
    };

    // ensure measure group exists / cleanup when toggling
    useEffect(() => {
        if (!map) return;
        if (enabled) {
            if (!measureGroupRef.current) measureGroupRef.current = L.layerGroup().addTo(map);
            map.pm.setGlobalOptions({ tooltips: false, measurement: false });
        } else {
            safeDisablePmModes();
            setActiveTool(null);
            setDrawing(false);
        }
    }, [enabled, map]);

    // core pm event handlers: create / drawstart / drawend
    useEffect(() => {
        if (!map || !enabled) return;

        const onCreate = (e) => {
            // If we manually finalized, ignore the duplicate pm:create that Geoman may fire
            if (manualFinalizeRef.current) {
                manualFinalizeRef.current = false;
                // working layer already removed/handled by manual finalize
                return;
            }

            const layer = e.layer;
            // clear working ref (finished by Geoman)
            workingLayerRef.current = null;

            // add created layer to measurement group, add measurements
            if (measureGroupRef.current && layer) {
                measureGroupRef.current.addLayer(layer);
                addMeasurements(layer);
            }
            setDrawing(false);

            // on edit refresh labels
            layer.on && layer.on("pm:edit", () => {
                clearMeasurements(layer);
                addMeasurements(layer);
            });
        };

        const onDrawStart = (e) => {
            setDrawing(true);
            if (e && e.workingLayer) {
                workingLayerRef.current = e.workingLayer;
            }

            // attach dblclick handler on map to finalize drawing for any shape
            const dbl = () => finalizeWorkingLayer();
            dblClickHandlerRef.current = dbl;
            map.on("dblclick", dbl);

            // if polygon, also attach click-first-vertex handler on working layer
            if (activeToolRef.current === "polygon" && e && e.workingLayer) {
                const working = e.workingLayer;
                const clickHandler = (evt) => {
                    try {
                        const latlngs = working.getLatLngs && working.getLatLngs()[0];
                        if (latlngs && latlngs.length > 2) {
                            const first = map.latLngToLayerPoint(latlngs[0]);
                            const clicked = map.latLngToLayerPoint(evt.latlng);
                            if (first.distanceTo(clicked) < 10) {
                                finalizeWorkingLayer();
                            }
                        }
                    } catch (err) {
                        // ignore
                    }
                };
                workingClickHandlerRef.current = clickHandler;
                working.on("click", clickHandler);
            }
        };

        const onDrawEnd = () => {
            // cleanup handlers attached during drawstart
            if (dblClickHandlerRef.current) {
                map.off("dblclick", dblClickHandlerRef.current);
                dblClickHandlerRef.current = null;
            }
            if (workingLayerRef.current && workingClickHandlerRef.current) {
                try {
                    workingLayerRef.current.off("click", workingClickHandlerRef.current);
                } catch (e) { }
                workingClickHandlerRef.current = null;
            }
            setDrawing(false);
        };

        map.on("pm:create", onCreate);
        map.on("pm:drawstart", onDrawStart);
        map.on("pm:drawend", onDrawEnd);

        return () => {
            map.off("pm:create", onCreate);
            map.off("pm:drawstart", onDrawStart);
            map.off("pm:drawend", onDrawEnd);
            // cleanup any remaining handlers
            if (dblClickHandlerRef.current) {
                map.off("dblclick", dblClickHandlerRef.current);
                dblClickHandlerRef.current = null;
            }
            if (workingLayerRef.current && workingClickHandlerRef.current) {
                try {
                    workingLayerRef.current.off("click", workingClickHandlerRef.current);
                } catch (e) { }
                workingClickHandlerRef.current = null;
            }
        };
    }, [map, enabled]);

    // prevent toolbar clicks/scrolls from reaching the map
    useEffect(() => {
        if (!map || !enabled) return;
        const id = setTimeout(() => {
            const toolbar = document.querySelector(".measure-toolbar");
            if (toolbar) {
                L.DomEvent.disableClickPropagation(toolbar);
                L.DomEvent.disableScrollPropagation(toolbar);
            }
        }, 0);
        return () => clearTimeout(id);
    }, [map, enabled]);

    // clear tooltips for a layer
    const clearMeasurements = (layer) => {
        if (!measureGroupRef.current) return;
        const labelsMap = edgeLabelsRef.current;
        if (labelsMap.has(layer)) {
            const tps = labelsMap.get(layer) || [];
            tps.forEach((tp) => {
                try {
                    if (measureGroupRef.current.hasLayer(tp)) measureGroupRef.current.removeLayer(tp);
                    if (map.hasLayer(tp)) map.removeLayer(tp);
                } catch (e) { }
            });
            labelsMap.delete(layer);
        }
        try {
            layer.unbindTooltip && layer.unbindTooltip();
        } catch (e) { }
    };

    // add labels/tooltips for a shape (per-edge + center)
    const addMeasurements = (layer) => {
        if (!measureGroupRef.current) return;
        const tooltips = [];

        // LINE (polyline but not polygon)
        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
            const latlngs = layer.getLatLngs();
            let dist = 0;
            for (let i = 1; i < latlngs.length; i++) dist += latlngs[i - 1].distanceTo(latlngs[i]);
            const mid = latlngs[Math.floor(latlngs.length / 2)];
            const tt = L.tooltip({ permanent: true, direction: "center", className: "distance-tooltip" })
                .setLatLng(mid)
                .setContent(fmtDist(dist));
            measureGroupRef.current.addLayer(tt);
            tooltips.push(tt);
        }

        // POLYGON & RECTANGLE (per-edge + total)
        if (layer instanceof L.Polygon && !(layer instanceof L.Circle)) {
            const latlngs = layer.getLatLngs()[0];
            let perimeter = 0;
            for (let i = 1; i < latlngs.length; i++) {
                const p1 = latlngs[i - 1];
                const p2 = latlngs[i];
                const d = p1.distanceTo(p2);
                perimeter += d;
                const midLat = (p1.lat + p2.lat) / 2;
                const midLng = (p1.lng + p2.lng) / 2;
                const txt = fmtDist(d);
                const edgeTooltip = L.tooltip({ permanent: true, direction: "center", className: "edge-tooltip" })
                    .setLatLng([midLat, midLng])
                    .setContent(txt);
                measureGroupRef.current.addLayer(edgeTooltip);
                tooltips.push(edgeTooltip);
            }
            const area = geodesicArea(latlngs);
            const totalText = `Perimeter: ${fmtDist(perimeter)} | Area: ${fmtArea(area)}`;
            const center = layer.getBounds().getCenter();
            const centerTooltip = L.tooltip({ permanent: true, direction: "center", className: "distance-tooltip" })
                .setLatLng(center)
                .setContent(totalText);
            measureGroupRef.current.addLayer(centerTooltip);
            tooltips.push(centerTooltip);
            edgeLabelsRef.current.set(layer, tooltips);
        }

        // CIRCLE
        if (layer instanceof L.Circle) {
            const r = layer.getRadius();
            const area = Math.PI * r * r;
            const txt = `Radius: ${fmtDist(r)} | Area: ${fmtArea(area)}`;
            const center = layer.getLatLng();
            const tt = L.tooltip({ permanent: true, direction: "center", className: "distance-tooltip" })
                .setLatLng(center)
                .setContent(txt);
            measureGroupRef.current.addLayer(tt);
            tooltips.push(tt);
            edgeLabelsRef.current.set(layer, tooltips);
        }
    };

    // remove everything from measurement group (safe clear)
    const clearAllMeasurements = () => {
        if (!measureGroupRef.current) return;
        const layers = [...measureGroupRef.current.getLayers()];
        layers.forEach((layer) => {
            try {
                if (edgeLabelsRef.current.has(layer)) {
                    const tps = edgeLabelsRef.current.get(layer) || [];
                    tps.forEach((tp) => {
                        try {
                            if (measureGroupRef.current.hasLayer(tp)) measureGroupRef.current.removeLayer(tp);
                            if (map.hasLayer(tp)) map.removeLayer(tp);
                        } catch (e) { }
                    });
                    edgeLabelsRef.current.delete(layer);
                }
                if (measureGroupRef.current.hasLayer(layer)) measureGroupRef.current.removeLayer(layer);
                if (map.hasLayer(layer)) map.removeLayer(layer);
            } catch (e) { }
        });
        try {
            measureGroupRef.current.clearLayers();
        } catch (e) { }
        edgeLabelsRef.current = new WeakMap();
    };

    // finalize the workingLayer ourselves (manual fallback)
    const finalizeWorkingLayer = () => {
        const w = workingLayerRef.current;
        if (!w) {
            // nothing to finalize, but still ensure pm draw is disabled
            map.pm.disableDraw();
            setDrawing(false);
            return;
        }

        // build a permanent equivalent layer (copy geometry)
        try {
            let newLayer = null;
            // Polygon/Rectangle
            if (typeof w.getLatLngs === "function" && w instanceof L.Polygon && !(w instanceof L.Circle)) {
                const data = w.getLatLngs();
                // if nested ring, take first ring
                const latlngs = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : data;
                newLayer = L.polygon(latlngs, { color: "#0b76ff", weight: 3, fillOpacity: 0.12 });
            }
            // Polyline (line)
            else if (typeof w.getLatLngs === "function" && w instanceof L.Polyline) {
                const latlngs = w.getLatLngs();
                newLayer = L.polyline(latlngs, { color: "#0b76ff", weight: 3 });
            }
            // Circle
            else if (typeof w.getLatLng === "function" && typeof w.getRadius === "function" && w instanceof L.Circle) {
                const center = w.getLatLng();
                const r = w.getRadius();
                newLayer = L.circle(center, { radius: r, color: "#0b76ff", weight: 3, fillOpacity: 0.12 });
            } else if (typeof w.getLatLngs === "function") {
                // fallback: try polygon
                const latlngs = w.getLatLngs();
                newLayer = L.polygon(latlngs, { color: "#0b76ff", weight: 3, fillOpacity: 0.12 });
            }

            // Remove working layer from map
            try {
                if (map.hasLayer(w)) map.removeLayer(w);
            } catch (e) { }

            workingLayerRef.current = null;

            if (newLayer) {
                manualFinalizeRef.current = true; // prevent duplicate pm:create
                measureGroupRef.current.addLayer(newLayer);
                addMeasurements(newLayer);
            }

            // disable draw mode (Geoman)
            map.pm.disableDraw();
            setDrawing(false);

            // cleanup listeners we attached
            if (dblClickHandlerRef.current) {
                map.off("dblclick", dblClickHandlerRef.current);
                dblClickHandlerRef.current = null;
            }
            if (workingClickHandlerRef.current && w) {
                try {
                    w.off && w.off("click", workingClickHandlerRef.current);
                } catch (e) { }
                workingClickHandlerRef.current = null;
            }

            // short timeout to clear manualFinalize flag if pm:create fires later
            setTimeout(() => {
                manualFinalizeRef.current = false;
            }, 50);
        } catch (err) {
            // fallback: just disable draw
            try {
                map.pm.disableDraw();
            } catch (e) { }
            workingLayerRef.current = null;
            setDrawing(false);
        }
    };

    const activateTool = (tool) => {
        setActiveTool(tool);
        activeToolRef.current = tool;

        // Always disable everything first
        safeDisablePmModes();

        const opts = { snappable: true };

        if (tool === "line") {
            map.pm.enableDraw("Line", { ...opts, finishOn: "dblclick" });
        }

        if (tool === "polygon" || tool === "rectangle") {
            const drawType = tool === "polygon" ? "Polygon" : "Rectangle";
            map.pm.enableDraw(drawType, opts);
        }

        if (tool === "circle") {
            map.pm.enableDraw("Circle", { ...opts, finishOn: "dblclick" });
        }

        // ✅ Restrict edit/move/delete to measurement group only
        if (measureGroupRef.current) {
            if (tool === "edit") {
                measureGroupRef.current.eachLayer((layer) => {
                    layer.pm && layer.pm.enable({ allowSelfIntersection: false });
                });
            }
            if (tool === "move") {
                measureGroupRef.current.eachLayer((layer) => {
                    layer.pm && layer.pm.enableLayerDrag();
                });
            }
            if (tool === "delete") {
                if (measureGroupRef.current) {
                    measureGroupRef.current.eachLayer((layer) => {
                        layer.on("click", () => {
                            clearMeasurements(layer); // remove tooltips
                            measureGroupRef.current.removeLayer(layer);
                            if (map.hasLayer(layer)) map.removeLayer(layer);
                        });
                    });
                }
            }
        }

        if (tool === "clear") {
            clearAllMeasurements();
            setActiveTool(null);
        }
    };


    // Finish button handler
    const handleFinish = (e) => {
        e && e.preventDefault && e.preventDefault();
        e && e.stopPropagation && e.stopPropagation();
        finalizeWorkingLayer();
    };

    // Cancel button handler
    const handleCancel = (e) => {
        e && e.preventDefault && e.preventDefault();
        e && e.stopPropagation && e.stopPropagation();
        if (workingLayerRef.current) {
            try {
                if (map.hasLayer(workingLayerRef.current)) map.removeLayer(workingLayerRef.current);
            } catch (err) { }
            workingLayerRef.current = null;
        }
        // clean listeners and turn off draw
        if (dblClickHandlerRef.current) {
            map.off("dblclick", dblClickHandlerRef.current);
            dblClickHandlerRef.current = null;
        }
        if (workingClickHandlerRef.current && workingLayerRef.current) {
            try {
                workingLayerRef.current.off && workingLayerRef.current.off("click", workingClickHandlerRef.current);
            } catch (e) { }
            workingClickHandlerRef.current = null;
        }
        map.pm.disableDraw();
        setDrawing(false);
    };

    return (
        <>
            {/* Toggle button */}
            <div
                className="custom-layer-control"
                style={{ top: "auto", bottom: "234px", right: "12px" }}
                ref={toggleRef}
            >
                <button
                    className={`custom-toggle-btn ${enabled ? "active" : ""}`}
                    title="Measurement Tools"
                    onClick={() => setEnabled((p) => !p)}
                >

<svg
  fill="#000000"
  height="20px"
  width="20px"
  version="1.2"
  baseProfile="tiny"
  id="Layer_1"
  xmlns="http://www.w3.org/2000/svg"
  xmlnsXlink="http://www.w3.org/1999/xlink"
  viewBox="-871 1129 256 256"
  xmlSpace="preserve"
>
<path d="M-871,1185.5l199.2,199.7l56.8-56.7l-199.2-199.7L-871,1185.5z M-627,1328.5l-36.3,36.3l-187.3-187.7l36.4-36.2l25.4,25.4
	l-11.2,11.2l6,6l11.2-11.2l12,12l-17.2,17.2l6,6l17.2-17.2l12,12l-11.2,11.2l6,6l11.2-11.2l12,12l-17.2,17.2l6,6l17.2-17.2l12,12
	l-11.2,11.2l6,6l11.2-11.2l12,12l-17.2,17.2l6,6l17.2-17.2l12,12l-11.2,11.2l6,6l11.2-11.2l12,12l-17.2,17.2l6,6l17.2-17.2l12,12
	l-11.2,11.2l6,6l11.2-11.2L-627,1328.5z M-820.3,1165.2c3.1,3,3.2,8,0.2,11.2c-3,3.1-8,3.2-11.2,0.2c-3.1-3-3.2-8-0.2-11.2
	C-828.5,1162.3-823.5,1162.2-820.3,1165.2z"/>
</svg>
                </button>
            </div>

            {/* Horizontal toolbar */}
            {enabled && (
                <div className="measure-toolbar">
                    <button className={activeTool === "line" ? "active" : ""} onClick={() => activateTool("line")}>
                        📏 Line
                    </button>
                    <button className={activeTool === "polygon" ? "active" : ""} onClick={() => activateTool("polygon")}>
                        🔺 Polygon
                    </button>
                    <button className={activeTool === "circle" ? "active" : ""} onClick={() => activateTool("circle")}>
                        🔵 Circle
                    </button>
                    <button className={activeTool === "rectangle" ? "active" : ""} onClick={() => activateTool("rectangle")}>
                        ⬛ Rectangle
                    </button>
                    <button className={activeTool === "edit" ? "active" : ""} onClick={() => activateTool("edit")}>
                        ✏️ Edit
                    </button>
                    <button className={activeTool === "move" ? "active" : ""} onClick={() => activateTool("move")}>
                        🔀 Move
                    </button>
                    <button className={activeTool === "delete" ? "active" : ""} onClick={() => activateTool("delete")}>
                        ❌ Delete
                    </button>
                    <button onClick={() => activateTool("clear")}>🗑 Clear All</button>

                    {/* Finish & Cancel shown only while drawing */}
                    {drawing && (
                        <>
                            <button onClick={handleFinish}>✅ Finish</button>
                            <button onClick={handleCancel}>❌ Cancel</button>
                        </>
                    )}
                </div>
            )}
        </>
    );
}

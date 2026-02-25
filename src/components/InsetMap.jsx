// src/components/InsetMap.jsx
import React, { useEffect } from "react";
import { MapContainer, TileLayer, WMSTileLayer, useMap } from "react-leaflet";
import ReactDOM from "react-dom";
import L from "leaflet";
import { baseLayers } from "/src/components/MapLayersToggle";

// ✅ Rounded Rectangle overlay
function RoundedRectangle({ bounds }) {
  const map = useMap();

  useEffect(() => {
    if (!bounds) return;

    const div = L.DomUtil.create("div", "custom-rectangle");
    div.style.border = "2px solid #7F1D1D";
    div.style.backgroundColor = "rgba(127, 29, 29, 0.2)";
    div.style.position = "absolute";

    const overlayPane = map.getPanes().overlayPane;
    overlayPane.appendChild(div);

    function update() {
      const nw = map.latLngToLayerPoint(bounds.getNorthWest());
      const se = map.latLngToLayerPoint(bounds.getSouthEast());
      const width = se.x - nw.x;
      const height = se.y - nw.y;

      div.style.left = nw.x + "px";
      div.style.top = nw.y + "px";
      div.style.width = width + "px";
      div.style.height = height + "px";

      const radius = Math.min(width, height) * 0.1;
      div.style.borderRadius = `${radius}px`;
    }

    update();
    map.on("zoomend moveend", update);

    return () => {
      try {
        if (overlayPane && div && overlayPane.contains(div)) {
          overlayPane.removeChild(div);
        }
      } catch (err) {
        // avoid blocking route transitions on teardown races
      }
      map.off("zoomend moveend", update);
    };
  }, [bounds, map]);

  return null;
}

// ✅ Sync inset map view with main map
function SyncView({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (center && zoom) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);

  return null;
}

// ✅ InsetMap Component
const InsetMap = React.memo(
  ({ bounds, centerZoom, isVisible, insetSize, activeBase }) => {
    const insetZoom = Math.max(centerZoom.zoom - 4, 1);

    return ReactDOM.createPortal(
      <div
        className={`fixed bottom-4 right-4 border-2 border-black shadow-lg overflow-hidden 
        transition-all duration-500 ease-in-out transform ${
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
        style={{
          width: insetSize,
          height: insetSize,
          borderRadius: "12px",
          zIndex: 999,
          pointerEvents: "none",
        }}
      >
        <MapContainer
          center={centerZoom.center}
          zoom={insetZoom}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          touchZoom={false}
          attributionControl={false}
        >
          {/* ✅ Use same base layer as main map */}
          {baseLayers[activeBase]?.type === "wms" ? (
            <WMSTileLayer
              url={baseLayers[activeBase].url}
              layers={baseLayers[activeBase].layers}
              format={baseLayers[activeBase].format}
              transparent={baseLayers[activeBase].transparent}
              version={baseLayers[activeBase].version}
              attribution={baseLayers[activeBase].attribution}
            />
          ) : (
            <TileLayer
              url={baseLayers[activeBase].url}
              attribution={baseLayers[activeBase].attribution}
            />
          )}
          {bounds && <RoundedRectangle bounds={bounds} />}
          <SyncView center={centerZoom.center} zoom={insetZoom} />
        </MapContainer>
      </div>,
      document.body
    );
  }
);

export default InsetMap;

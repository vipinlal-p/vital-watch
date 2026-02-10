// src/components/ZoomControlButton.jsx
import React, { useRef, useEffect } from "react";
import { useMap } from "react-leaflet";
import { Expand } from "lucide-react"; // ✅ import icon
import L from "leaflet";

function ZoomControlButton({
  defaultCenter = [10.012, 76.5573],
  defaultZoom = 10,
}) {
  const map = useMap();
  const zoomGroupRef = useRef(null);

  const handleZoomIn = (e) => {
    e.stopPropagation(); // ✅ block bubbling
    map.setZoom(map.getZoom() + 1);
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    map.setZoom(map.getZoom() - 1);
  };

  const handleReset = (e) => {
    e.stopPropagation();
    map.setView(defaultCenter, defaultZoom); // ✅ reset to default
  };

  // ✅ Block click & scroll propagation on the whole group
  useEffect(() => {
    if (zoomGroupRef.current) {
      L.DomEvent.disableClickPropagation(zoomGroupRef.current);
      L.DomEvent.disableScrollPropagation(zoomGroupRef.current);
    }
  }, []);

  return (
    <div className="custom-zoom-group" ref={zoomGroupRef}>
      <button
        className="custom-zoom-btn"
        title="Zoom In"
        onClick={handleZoomIn}
      >
        +
      </button>
      <button
        className="custom-zoom-btn"
        title="Zoom Out"
        onClick={handleZoomOut}
      >
        −
      </button>
      <button
        className="custom-zoom-btn"
        title="Reset View"
        onClick={handleReset}
      >
        <Expand size={18} /> {/* ✅ fullscreen/expand icon */}
      </button>
    </div>
  );
}

export default ZoomControlButton;

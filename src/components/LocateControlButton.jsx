// src/components/LocateControlButton.jsx
import React, { useState, useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { LocateFixed } from "lucide-react";
import L from "leaflet";

function LocateControlButton() {
  const map = useMap();
  const [active, setActive] = useState(false);
  const btnGroupRef = useRef(null);

  const handleLocate = (e) => {
    e.stopPropagation(); // extra safety

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.setView([latitude, longitude], 14);
        setActive(true); // ✅ turn blue
      },
      () => {
        alert("Unable to retrieve your location.");
      }
    );
  };

  // ✅ Reset to gray if user pans/zooms
  useEffect(() => {
    const reset = () => setActive(false);
    map.on("movestart zoomstart", reset);
    return () => {
      map.off("movestart zoomstart", reset);
    };
  }, [map]);

  // ✅ Block click + scroll propagation
  useEffect(() => {
    if (btnGroupRef.current) {
      L.DomEvent.disableClickPropagation(btnGroupRef.current);
      L.DomEvent.disableScrollPropagation(btnGroupRef.current);
    }
  }, []);

  return (
    <div className="custom-zoom-group" style={{ top: "190px" }} ref={btnGroupRef}>
      <button
        className={`custom-zoom-btn locate-btn ${active ? "active" : ""}`}
        title="Locate Me"
        onClick={handleLocate}
      >
        <LocateFixed size={22} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default LocateControlButton;

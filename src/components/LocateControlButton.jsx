// src/components/LocateControlButton.jsx
import React, { useState, useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { LocateFixed } from "lucide-react";
import L from "leaflet";

function LocateControlButton() {
  const map = useMap();
  const [active, setActive] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const btnGroupRef = useRef(null);

  const locateOnce = (options) =>
    new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

  const handleLocate = async (e) => {
    e.stopPropagation();

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    if (isLocating) return;
    setIsLocating(true);
    try {
      const fastPos = await locateOnce({
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 600000,
      });
      const { latitude, longitude } = fastPos.coords;
      map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), {
        duration: 0.5,
      });
      setActive(true);
      setIsLocating(false);
      window.dispatchEvent(
        new CustomEvent("vitalwatch:locate", {
          detail: { latitude, longitude },
        })
      );
    } catch {
      try {
        const precisePos = await locateOnce({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
        const { latitude, longitude } = precisePos.coords;
        map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), {
          duration: 0.5,
        });
        setActive(true);
        setIsLocating(false);
        window.dispatchEvent(
          new CustomEvent("vitalwatch:locate", {
            detail: { latitude, longitude },
          })
        );
      } catch (err) {
        setIsLocating(false);
        if (err?.code === 1) {
          alert("Location permission denied. Enable location access in browser/site settings.");
          return;
        }
        if (err?.code === 2) {
          alert("Location unavailable. Please check GPS/network and try again.");
          return;
        }
        if (err?.code === 3) {
          alert("Location request timed out. Please try again.");
          return;
        }
        alert("Unable to retrieve your location.");
      }
    }
  };

  // ✅ Block click + scroll propagation
  useEffect(() => {
    if (btnGroupRef.current) {
      L.DomEvent.disableClickPropagation(btnGroupRef.current);
      L.DomEvent.disableScrollPropagation(btnGroupRef.current);
    }
  }, []);

  return (
    <div
      className="custom-zoom-group"
      style={{ top: "auto", bottom: "184px", right: "12px" }}
      ref={btnGroupRef}
    >
      <button
        className={`custom-zoom-btn locate-btn ${active ? "active" : ""}`}
        title={isLocating ? "Locating..." : "Locate Me"}
        onClick={handleLocate}
      >
        <LocateFixed size={22} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default LocateControlButton;

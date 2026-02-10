// src/components/SearchBar.jsx
import React, { useState, useRef, useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import {
  Search,
  X,
  MapPin,
  ArrowRight,
  CornerDownLeft,
  CornerDownRight,
  Navigation,
  Flag,
  Clipboard,
} from "lucide-react";
import "../styles/search-bar.css";
import { useDebounce } from "/src/hooks";

export default function SearchBar({
  placeholder = "Search location...",
  onLocationChange,
  onDestinationChange,
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [hasRoute, setHasRoute] = useState(false);
  const [steps, setSteps] = useState([]);

  const map = useMap();
  const markerRef = useRef(null);
  const routingRef = useRef(null);
  const controlRef = useRef(null); // wrapper ref

  // ✅ Custom red marker icon
  const redIcon = new L.Icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  // -----------------------------
  // Block only wheel/dblclick/touchmove (allow single clicks)
  // -----------------------------
  useEffect(() => {
    const el = controlRef.current;
    if (!el) return;

    const onWheel = (e) => e.stopPropagation();
    const onDblClick = (e) => e.stopPropagation();
    const onTouchMove = (e) => e.stopPropagation();

    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("dblclick", onDblClick);
    el.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDblClick);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  // -----------------------------
  // Get current location
  // -----------------------------
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        if (onLocationChange) onLocationChange(loc);
      },
      (err) => console.warn("Geolocation unavailable:", err?.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // Fetch suggestions (Nominatim) for the debounced input
  // -----------------------------
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const fetchSuggestions = async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          debouncedQuery
        )}&addressdetails=1&limit=5`;
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled) setSuggestions(data || []);
      } catch (err) {
        console.error("Suggestion error:", err);
      }
    };
    fetchSuggestions();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // -----------------------------
  // Place marker / select place
  // -----------------------------
  const handleSelect = (place) => {
    if (!place) return;
    const { lat, lon, display_name } = place;
    const coords = [parseFloat(lat), parseFloat(lon)];
    try {
      map.setView(coords, 14);
    } catch {}

    if (markerRef.current) {
      try {
        map.removeLayer(markerRef.current);
      } catch {}
      markerRef.current = null;
    }

    const marker = L.marker(coords, { icon: redIcon }).addTo(map);
    markerRef.current = marker;
    marker.bindPopup(`<b>${display_name}</b>`).openPopup();

    setQuery(display_name);
    setSuggestions([]);
    setDestination(coords);
    if (onDestinationChange) onDestinationChange(coords);
  };

  // -----------------------------
  // handleSearch now accepts an optional override text.
  // If overrideText is provided we query Nominatim immediately with it.
  // If no overrideText and suggestions exist we pick suggestions[0].
  // Otherwise we use debouncedQuery.
  // -----------------------------
  const handleSearch = async (overrideText) => {
    const useText = overrideText ?? debouncedQuery ?? "";
    if (!useText.trim()) return;

    // If suggestions exist and there's NO overrideText -> choose the first suggestion (fast)
    if (!overrideText && suggestions.length > 0) {
      handleSelect(suggestions[0]);
      return;
    }

    // Otherwise, fetch 1 result from Nominatim for the supplied text
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        useText
      )}&addressdetails=1&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (data?.length > 0) {
        handleSelect(data[0]);
      } else {
        alert("No results found for: " + useText);
      }
    } catch (err) {
      console.error("Search error:", err);
      alert("Search failed. Check console.");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSearch(); // uses debouncedQuery / suggestions behaviour
  };

  // -----------------------------
  // Paste + immediate search (with fallback prompt)
  // -----------------------------
  const handlePasteAndSearch = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error("Clipboard API not available");
      }
      const text = await navigator.clipboard.readText();
      if (!text) {
        alert("Clipboard is empty.");
        return;
      }
      setQuery(text);
      setIsFocused(true);
      // Immediately search using the pasted text (no debounce wait)
      await handleSearch(text);
    } catch (err) {
      // Fallback to prompt if clipboard read fails (or not allowed)
      console.warn("Clipboard read failed, falling back to prompt:", err);
      const pasted = window.prompt("Paste location text here:");
      if (pasted) {
        setQuery(pasted);
        setIsFocused(true);
        await handleSearch(pasted);
      } else {
        // user cancelled prompt
      }
    }
  };

  // -----------------------------
  // Clear routing and marker helpers
  // -----------------------------
  const clearRouting = () => {
    if (routingRef.current) {
      if (routingRef.current.type === "geojson") {
        try {
          map.removeLayer(routingRef.current.layer);
        } catch {}
      }
      routingRef.current = null;
    }
    setHasRoute(false);
    setSteps([]);
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setDestination(null);
    if (markerRef.current) {
      try {
        map.removeLayer(markerRef.current);
      } catch {}
      markerRef.current = null;
    }
    clearRouting();
  };

  // -----------------------------
  // Helpers: distance, instruction, icons
  // -----------------------------
  const formatDistance = (m) => {
    if (!m && m !== 0) return "";
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(1)} km`;
  };

  const buildInstruction = (step, isFirst, isLast) => {
    const maneuver = step.maneuver || {};
    const type = maneuver.type;
    const modifier = maneuver.modifier;
    const road = step.name || "";

    if (isFirst) return "Start at your location";
    if (isLast) return "Arrive at destination";

    switch (type) {
      case "turn":
        if (modifier === "left")
          return `Turn left${road ? " onto " + road : ""}`;
        if (modifier === "right")
          return `Turn right${road ? " onto " + road : ""}`;
        if (modifier === "slight left")
          return `Slight left${road ? " onto " + road : ""}`;
        if (modifier === "slight right")
          return `Slight right${road ? " onto " + road : ""}`;
        if (modifier === "uturn") return "Make a U-turn";
        return `Turn ${modifier || ""}${road ? " onto " + road : ""}`;
      case "depart":
        return `Head ${modifier || "straight"}${road ? " on " + road : ""}`;
      case "arrive":
        return "Arrive at destination";
      case "roundabout":
        return `Enter the roundabout${road ? " and exit onto " + road : ""}`;
      case "merge":
        return `Merge${road ? " onto " + road : ""}`;
      case "new name":
        return `Continue${road ? " onto " + road : ""}`;
      default:
        return road ? `Continue on ${road}` : "Continue straight";
    }
  };

  const getIconForStep = (type, modifier, isFirst, isLast) => {
    if (isFirst) return <Navigation className="step-icon start" size={18} />;
    if (isLast) return <Flag className="step-icon finish" size={18} />;

    if (type === "turn") {
      switch (modifier) {
        case "left":
          return <CornerDownLeft className="step-icon" size={18} />;
        case "right":
          return <CornerDownRight className="step-icon" size={18} />;
        case "slight left":
          return <CornerDownLeft className="step-icon slight" size={18} />;
        case "slight right":
          return <CornerDownRight className="step-icon slight" size={18} />;
        case "uturn":
          return (
            <ArrowRight
              className="step-icon uturn"
              size={18}
              style={{ transform: "rotate(180deg)" }}
            />
          );
        default:
          return <ArrowRight className="step-icon" size={18} />;
      }
    }

    if (type === "roundabout") {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="step-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v3" />
          <path d="M12 18v3" />
          <path d="M3 12h3" />
          <path d="M18 12h3" />
        </svg>
      );
    }

    return <ArrowRight className="step-icon" size={18} />;
  };

  // -----------------------------
  // Routing (OSRM)
  // -----------------------------
  const handleDirections = async () => {
    if (!destination) {
      alert("Please select a destination first.");
      return;
    }

    let start = userLocation;
    if (!start) {
      try {
        start = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve([p.coords.latitude, p.coords.longitude]),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });
        setUserLocation(start);
      } catch (err) {
        console.error("Could not acquire geolocation:", err);
        alert("Unable to get your current location.");
        return;
      }
    }

    clearRouting();

    try {
      const startLonLat = `${start[1]},${start[0]}`;
      const destLonLat = `${destination[1]},${destination[0]}`;
      const url = `https://router.project-osrm.org/route/v1/driving/${startLonLat};${destLonLat}?overview=full&geometries=geojson&steps=true`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
      const json = await res.json();
      if (!json.routes?.length) throw new Error("No routes returned");

      const geom = json.routes[0].geometry;
      const layer = L.geoJSON(geom, {
        style: { color: "#1a73e8", weight: 5, opacity: 0.95 },
      }).addTo(map);

      routingRef.current = { type: "geojson", layer };
      setHasRoute(true);

      map.fitBounds(layer.getBounds(), { padding: [40, 40] });

      const legs = json.routes[0].legs;
      const allSteps = [];
      legs.forEach((leg, legIndex) =>
        leg.steps.forEach((s, i) => {
          const isFirst = i === 0 && legIndex === 0;
          const isLast =
            legIndex === legs.length - 1 && i === leg.steps.length - 1;

          allSteps.push({
            text: buildInstruction(s, isFirst, isLast),
            type: s.maneuver.type || "straight",
            modifier: s.maneuver.modifier || "straight",
            distance: s.distance || 0,
          });
        })
      );
      setSteps(allSteps);

      map.fitBounds(layer.getBounds(), { padding: [40, 40] });
    } catch (err) {
      console.error("OSRM routing failed:", err);
      alert("Routing failed. Check console.");
    }
  };

  // -----------------------------
  // Cleanup
  // -----------------------------
  useEffect(() => {
    return () => {
      if (markerRef.current) {
        try {
          map.removeLayer(markerRef.current);
        } catch {}
      }
      clearRouting();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="map-search-wrapper" ref={controlRef}>
      <form className="map-search-bar" onSubmit={handleSubmit}>
        {/* Search button */}
        <button
          type="button"
          className="map-search-icon-btn"
          onClick={() => handleSearch()}
        >
          <Search className="map-search-icon" />
        </button>

        {/* Input */}
        <input
          type="text"
          placeholder={placeholder}
          className="map-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        />

        {/* Paste & Search (one click: paste from clipboard + immediate search) */}
        <button
          type="button"
          className="map-paste-btn"
          title="Paste and Search"
          onClick={handlePasteAndSearch}
        >
          <Clipboard size={16} />
        </button>

        {/* Clear button */}
        {query && (
          <button
            type="button"
            className="map-search-clear"
            onClick={handleClear}
          >
            <X size={16} />
          </button>
        )}

        {/* Directions button */}
        <button
          type="button"
          className={`map-directions-btn ${hasRoute ? "active" : ""}`}
          title={hasRoute ? "Clear Route" : "Get Directions"}
          onClick={hasRoute ? clearRouting : handleDirections}
        >
          {hasRoute ? (
            <X size={18} />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="currentColor"
            >
              <path d="M21.71 11.29l-9-9a1 1 0 00-1.42 0l-9 9a1 1 0 000 1.42l9 9a1 1 0 001.42 0l9-9a1 1 0 000-1.42zM12 20.59L3.41 12 12 3.41 20.59 12 12 20.59zM11 6v5H8l4 4 4-4h-3V6h-2z" />
            </svg>
          )}
        </button>
      </form>

      {/* Directions Panel */}
      {hasRoute && steps.length > 0 && (
        <div className="directions-panel">
          <h4>Directions</h4>
          <ol>
            {steps.map((s, i) => (
              <li key={i} className="step-item">
                {getIconForStep(
                  s.type,
                  s.modifier,
                  i === 0,
                  i === steps.length - 1
                )}
                <div className="step-text">
                  <span className="instruction-text">{s.text}</span>
                  {s.distance > 0 && (
                    <small className="step-distance">
                      {formatDistance(s.distance)}
                    </small>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Suggestions dropdown */}
      {isFocused && suggestions.length > 0 && (
        <ul className="map-search-suggestions">
          {suggestions.slice(0, 3).map((s, i) => {
            const [title, ...rest] = s.display_name.split(",");
            const subtitle = rest.join(", ").trim();
            return (
              <li
                key={i}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(s);
                }}
              >
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-gray-500 mt-1" />
                  <div>
                    <div className="map-suggestion-title">{title}</div>
                    {subtitle && (
                      <div className="map-suggestion-sub">{subtitle}</div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

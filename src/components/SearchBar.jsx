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
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [hasRoute, setHasRoute] = useState(false);
  const [steps, setSteps] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [navHeading, setNavHeading] = useState(0);
  const [nextStepDistance, setNextStepDistance] = useState(null);

  const map = useMap();
  const markerRef = useRef(null);
  const routingRef = useRef(null);
  const controlRef = useRef(null); // wrapper ref
  const directionsAbortRef = useRef(null);
  const directionsRequestIdRef = useRef(0);
  const navWatchIdRef = useRef(null);
  const activeStepIndexRef = useRef(0);
  const currentNavMarkerRef = useRef(null);
  const alertCooldownRef = useRef({});
  const lastNavLocRef = useRef(null);

  useEffect(() => {
    activeStepIndexRef.current = activeStepIndex;
  }, [activeStepIndex]);

  const alertWithCooldown = (key, message, cooldownMs = 10000) => {
    const now = Date.now();
    const last = alertCooldownRef.current[key] || 0;
    if (now - last >= cooldownMs) {
      alertCooldownRef.current[key] = now;
      alert(message);
    }
  };

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

  const currentNavArrowIcon = L.divIcon({
    className: "current-nav-arrow-marker",
    html: '<div class="current-nav-arrow-shape"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  // -----------------------------
  // Block only wheel/dblclick/touchmove (allow single clicks)
  // -----------------------------
  useEffect(() => {
    const el = controlRef.current;
    if (!el) return;

    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);

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
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSuggestionError("");
      setIsLoadingSuggestions(false);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    const fetchSuggestions = async () => {
      setIsLoadingSuggestions(true);
      setSuggestionError("");
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
          trimmed
        )}&addressdetails=1&limit=5`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Suggestion HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Suggestion error:", err);
        if (!cancelled) {
          setSuggestions([]);
          setSuggestionError("Could not load suggestions.");
        }
      } finally {
        if (!cancelled) setIsLoadingSuggestions(false);
      }
    };
    fetchSuggestions();
    return () => {
      cancelled = true;
      controller.abort();
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
    setIsFocused(false);
    setDestination(coords);
    if (onDestinationChange) onDestinationChange(coords);
  };

  const handleSuggestionPick = (e, place) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelect(place);
  };

  // -----------------------------
  // handleSearch now accepts an optional override text.
  // If overrideText is provided we query Nominatim immediately with it.
  // If no overrideText and suggestions exist we pick suggestions[0].
  // Otherwise we use the current query text.
  // -----------------------------
  const handleSearch = async (overrideText) => {
    const useText = overrideText ?? query ?? "";
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
    handleSearch(); // uses current query / suggestions behaviour
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
    stopNavigation();
    if (directionsAbortRef.current) {
      directionsAbortRef.current.abort();
      directionsAbortRef.current = null;
    }
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
    setActiveStepIndex(0);
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setDestination(null);
    if (onDestinationChange) onDestinationChange(null);
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

  const stopNavigation = () => {
    if (navWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(navWatchIdRef.current);
      navWatchIdRef.current = null;
    }
    if (currentNavMarkerRef.current) {
      try {
        map.removeLayer(currentNavMarkerRef.current);
      } catch {}
      currentNavMarkerRef.current = null;
    }
    lastNavLocRef.current = null;
    setIsNavigating(false);
    setNavHeading(0);
    setNextStepDistance(null);
  };

  const distanceMeters = (a, b) => {
    if (!a || !b) return Number.POSITIVE_INFINITY;
    return L.latLng(a[0], a[1]).distanceTo(L.latLng(b[0], b[1]));
  };

  const bearingDegrees = (from, to) => {
    if (!from || !to) return 0;
    const toRad = (d) => (d * Math.PI) / 180;
    const toDeg = (r) => (r * 180) / Math.PI;
    const [lat1, lon1] = from;
    const [lat2, lon2] = to;
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const dlambda = toRad(lon2 - lon1);
    const y = Math.sin(dlambda) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(dlambda);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };

  const focusStep = (index) => {
    const step = steps[index];
    if (!step) return;
    setActiveStepIndex(index);
    if (step.location) {
      map.flyTo(step.location, Math.max(map.getZoom(), 16), { duration: 0.5 });
    }
  };

  const updateActiveStepByLocation = (loc, forceFromStart = false) => {
    if (!steps.length) return;
    const startIndex = forceFromStart ? 0 : activeStepIndexRef.current;
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = startIndex; i < steps.length; i += 1) {
      if (!steps[i].location) continue;
      const d = distanceMeters(loc, steps[i].location);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0 && bestDistance < 120) {
      setActiveStepIndex(bestIndex);
      setNextStepDistance(bestDistance);
      return;
    }
    setNextStepDistance(null);
  };

  const startNavigation = () => {
    if (!hasRoute || steps.length === 0) {
      alert("Get directions first.");
      return;
    }
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    stopNavigation();
    setIsNavigating(true);

    const onPosition = (pos) => {
      const loc = [pos.coords.latitude, pos.coords.longitude];
      setUserLocation(loc);
      if (onLocationChange) onLocationChange(loc);
      if (!currentNavMarkerRef.current) {
        currentNavMarkerRef.current = L.marker(loc, {
          icon: currentNavArrowIcon,
          interactive: false,
        }).addTo(map);
      } else {
        currentNavMarkerRef.current.setLatLng(loc);
      }

      const rawHeading = pos.coords.heading;
      const computedHeading =
        Number.isFinite(rawHeading) && rawHeading >= 0
          ? rawHeading
          : lastNavLocRef.current
            ? bearingDegrees(lastNavLocRef.current, loc)
            : navHeading;
      setNavHeading(computedHeading);
      const markerEl = currentNavMarkerRef.current.getElement?.();
      if (markerEl) {
        markerEl.style.setProperty("--nav-heading", `${computedHeading}deg`);
      }
      lastNavLocRef.current = loc;

      updateActiveStepByLocation(loc);
      map.setView(loc, Math.max(map.getZoom(), 16));
    };

    navWatchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      (err) => {
        console.error("Navigation tracking error:", err);
        alertWithCooldown("navigation-tracking-failed", "Navigation tracking failed.");
        stopNavigation();
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
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
        if (onLocationChange) onLocationChange(start);
      } catch (err) {
        // fallback to map center to prevent repeated location error loops
        console.warn("Could not acquire geolocation; using map center.", err);
        const center = map.getCenter();
        start = [center.lat, center.lng];
        setUserLocation(start);
        if (onLocationChange) onLocationChange(start);
        alertWithCooldown(
          "directions-location-fallback",
          "Using current map center as start location."
        );
      }
    }

    clearRouting();

    try {
      const requestId = ++directionsRequestIdRef.current;
      const controller = new AbortController();
      directionsAbortRef.current = controller;

      const startLonLat = `${start[1]},${start[0]}`;
      const destLonLat = `${destination[1]},${destination[0]}`;
      const url = `https://router.project-osrm.org/route/v1/driving/${startLonLat};${destLonLat}?overview=full&geometries=geojson&steps=true`;

      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
      const json = await res.json();
      if (!json.routes?.length) throw new Error("No routes returned");
      if (requestId !== directionsRequestIdRef.current) return;

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
            location: Array.isArray(s?.maneuver?.location)
              ? [s.maneuver.location[1], s.maneuver.location[0]]
              : null,
          });
        })
      );
      setSteps(allSteps);
      setActiveStepIndex(0);
      setNextStepDistance(null);
      if (userLocation) {
        updateActiveStepByLocation(userLocation, true);
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
      console.error("OSRM routing failed:", err);
      alert("Routing failed. Check console.");
    } finally {
      if (!directionsAbortRef.current?.signal?.aborted) {
        directionsAbortRef.current = null;
      }
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
      <div className="map-search-row">
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
          onChange={(e) => {
            setQuery(e.target.value);
            setIsFocused(true);
          }}
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
      </form>

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
    viewBox="0 0 360 360"
    width="24"
    height="24"
    fill="currentColor"
  >
<path d="M0 0 C0.92941406 0.44859375 1.85882813 0.8971875 2.81640625 1.359375 C33.93999061 17.12989465 56.25993039 46.56540765 67.4609375 79.0859375 C71.34950303 91.04745136 73.60814609 103.42660064 74 116 C74.03996094 116.84820312 74.07992188 117.69640625 74.12109375 118.5703125 C75.08694514 155.7271837 60.27758288 190.26078818 35 217 C34.24203125 217.82242188 33.4840625 218.64484375 32.703125 219.4921875 C9.62695915 243.69953795 -23.97495529 257.21012647 -57.11328125 258.21875 C-75.81793303 258.57990176 -92.39769012 256.32583011 -110 250 C-110.6909375 249.75266113 -111.381875 249.50532227 -112.09375 249.25048828 C-145.93263468 236.86415021 -172.63719063 210.63089175 -187.86401367 178.16210938 C-195.90738515 160.23574164 -199.43550427 141.59806215 -199.375 122 C-199.3737915 121.27356293 -199.37258301 120.54712585 -199.37133789 119.79867554 C-199.31741924 107.82035212 -198.48431994 96.51401877 -195 85 C-194.73687012 84.12375977 -194.47374023 83.24751953 -194.20263672 82.34472656 C-188.68338649 64.59691683 -180.44490059 47.94128143 -168 34 C-166.95779297 32.77990234 -166.95779297 32.77990234 -165.89453125 31.53515625 C-124.47735924 -16.03961301 -55.87404518 -28.41704016 0 0 Z M-146.62988281 36.68115234 C-147.74198028 37.75163533 -148.87917081 38.796006 -150.0234375 39.83203125 C-170.34097528 58.67106276 -180.98899035 89.06457198 -182.21875 116.19921875 C-183.17452865 149.10841541 -171.5250542 179.8587593 -149.05859375 203.84375 C-148.37925781 204.5553125 -147.69992188 205.266875 -147 206 C-146.47535156 206.5878125 -145.95070312 207.175625 -145.41015625 207.78125 C-125.67510296 229.07301233 -95.38996789 239.73822365 -67 241 C-66.13375 241.04125 -65.2675 241.0825 -64.375 241.125 C-31.89783929 241.89826573 -2.81322659 228.35111593 21 207 C23.52945697 204.47054303 25.77296599 201.79707742 28 199 C28.76957031 198.07832031 29.53914062 197.15664063 30.33203125 196.20703125 C39.73080495 184.72978796 46.18884504 172.22065058 50.9375 158.1875 C51.22004639 157.35283203 51.50259277 156.51816406 51.79370117 155.65820312 C61.23561982 126.12506292 56.89217099 93.36864295 43.08154297 66.01025391 C39.66097555 59.4723318 35.77294154 53.627357 31 48 C30.24976563 47.04480469 29.49953125 46.08960938 28.7265625 45.10546875 C23.14946175 38.11210109 17.18655486 32.3638779 10 27 C9.23429688 26.40832031 8.46859375 25.81664063 7.6796875 25.20703125 C-8.95648567 12.88498434 -27.64605895 6.03010416 -48 3 C-49.00804687 2.84402344 -50.01609375 2.68804687 -51.0546875 2.52734375 C-86.61354716 -1.57560159 -121.37338819 12.19122864 -146.62988281 36.68115234 Z " fill="#020202" transform="translate(243,59)"/>
<path d="M0 0 C2 2 2 2 2.07557678 3.8710022 C1.40298505 9.34137507 0.14393348 14.19386832 -1.81640625 19.3359375 C-2.2480735 20.5056031 -2.2480735 20.5056031 -2.6884613 21.69889832 C-3.63681565 24.26130531 -4.59954553 26.81804792 -5.5625 29.375 C-6.23984396 31.19619439 -6.91625794 33.0177349 -7.59179688 34.83959961 C-9.00616401 38.64864432 -10.42657553 42.4553525 -11.85205078 46.26025391 C-13.92242147 51.78758881 -15.97680249 57.3207523 -18.02734375 62.85546875 C-23.30375362 77.0867925 -28.60475024 91.30874261 -33.95703125 105.51171875 C-34.92524603 108.08293502 -35.89336134 110.6541887 -36.86141968 113.22546387 C-37.49133329 114.89749896 -38.12187911 116.56929602 -38.75308228 118.24084473 C-42.01726237 126.88861314 -45.22471397 135.54785399 -48.2421875 144.28515625 C-48.49564438 145.01578278 -48.74910126 145.7464093 -49.01023865 146.49917603 C-50.19210437 149.91065922 -51.3596885 153.32578527 -52.5012207 156.75097656 C-52.90687256 157.93272461 -53.31252441 159.11447266 -53.73046875 160.33203125 C-54.07489014 161.36046143 -54.41931152 162.3888916 -54.77416992 163.44848633 C-56.14534249 166.30252428 -57.2452238 167.47342624 -60 169 C-63.125 168.875 -63.125 168.875 -66 168 C-68.09946793 164.8507981 -68.29213828 163.83772338 -68.48657227 160.20336914 C-68.54325577 159.22707047 -68.59993927 158.25077179 -68.65834045 157.24488831 C-68.71050217 156.18567673 -68.76266388 155.12646515 -68.81640625 154.03515625 C-68.87779282 152.93264023 -68.93917938 151.83012421 -69.00242615 150.69419861 C-69.19764626 147.1507032 -69.38019755 143.6066811 -69.5625 140.0625 C-69.68862981 137.74018951 -69.81557428 135.41792312 -69.94335938 133.09570312 C-70.25171809 127.44979767 -70.54730159 121.80332395 -70.83700562 116.15643311 C-70.99105302 113.1732608 -71.14975489 110.19037441 -71.30981445 107.20751953 C-71.7418497 99.05225318 -72.16157459 90.91984321 -72.0625 82.75 C-72.05798828 81.98171875 -72.05347656 81.2134375 -72.04882812 80.421875 C-72.03753231 78.61454534 -72.01964411 76.8072582 -72 75 C-72.65887207 75.00933563 -73.31774414 75.01867126 -73.99658203 75.02828979 C-83.31046044 75.09929413 -92.57662424 74.66630969 -101.875 74.1953125 C-103.57462531 74.11041594 -105.27425097 74.02552634 -106.97387695 73.94064331 C-110.51054006 73.76307114 -114.0470502 73.58272226 -117.58349609 73.40087891 C-122.11346545 73.16856229 -126.643911 72.94745865 -131.17456055 72.72886848 C-134.67327124 72.55812794 -138.17154154 72.3794117 -141.66973877 72.19848251 C-143.34093503 72.11340803 -145.01228518 72.03130188 -146.68377686 71.9522438 C-149.01236222 71.84133286 -151.34009997 71.71918134 -153.66796875 71.59423828 C-154.35474197 71.56402588 -155.0415152 71.53381348 -155.74909973 71.50268555 C-159.2377309 71.30300377 -162.12849085 71.09592486 -165 69 C-166.0625 65.625 -166.0625 65.625 -166 62 C-162.87883252 58.99909256 -159.87026979 57.32617666 -155.8125 55.90625 C-154.75087646 55.52694336 -153.68925293 55.14763672 -152.59545898 54.75683594 C-151.40895752 54.34208008 -150.22245605 53.92732422 -149 53.5 C-146.25954461 52.52164918 -143.52235768 51.53428772 -140.78515625 50.546875 C-140.02985123 50.27522522 -139.2745462 50.00357544 -138.49635315 49.72369385 C-127.76545587 45.85238653 -117.10633524 41.78836659 -106.4375 37.75 C-104.19559659 36.90223809 -101.9536527 36.05458324 -99.71166992 35.20703125 C-96.20728665 33.88223804 -92.70293238 32.55736887 -89.19874573 31.23205566 C-80.62783277 27.99106689 -72.05391985 24.75811877 -63.47841454 21.5293045 C-61.37695085 20.73805114 -59.27554087 19.9466553 -57.17414856 19.1552124 C-55.7861027 18.63244522 -54.39805643 18.1096791 -53.01000977 17.58691406 C-52.32745526 17.32985058 -51.64490076 17.07278709 -50.94166279 16.80793381 C-47.56031504 15.53453036 -44.1788372 14.26147436 -40.79708862 12.98913574 C-38.22524277 12.02149417 -35.65359722 11.05332393 -33.08218384 10.08453369 C-30.74839885 9.2052754 -28.41433464 8.32675766 -26.07992554 7.44915771 C-20.39225401 5.30501075 -14.74164307 3.10713945 -9.1401825 0.74572754 C-5.87929457 -0.39049983 -3.41973157 -0.42746645 0 0 Z " fill="#010101" transform="translate(244,114)"/>
<path d="M0 0 C0.66 0.33 1.32 0.66 2 1 C0.35 2.65 -1.3 4.3 -3 6 C-2.67 6.66 -2.34 7.32 -2 8 C-2.99 8.33 -3.98 8.66 -5 9 C-5.33 9.33 -5.66 9.66 -6 10 C-7.66617115 10.04063832 -9.33388095 10.042721 -11 10 C-7.50640535 6.40365256 -3.88901869 3.16548033 0 0 Z " fill="#0F0F0F" transform="translate(99,70)"/>
<path d="M0 0 C0.66 0 1.32 0 2 0 C2.33 2.97 2.66 5.94 3 9 C2.34 9 1.68 9 1 9 C0.67 9.99 0.34 10.98 0 12 C-0.19573608 10.56359829 -0.38127816 9.12580496 -0.5625 7.6875 C-0.66691406 6.88699219 -0.77132813 6.08648437 -0.87890625 5.26171875 C-1 3 -1 3 0 0 Z " fill="#090909" transform="translate(298,154)"/>
<path d="M0 0 C4.75 0.75 4.75 0.75 7 3 C5.02 3.99 5.02 3.99 3 5 C1.5 3.625 1.5 3.625 0 2 C0 1.34 0 0.68 0 0 Z " fill="#0B0B0B" transform="translate(113,281)"/>
<path d="M0 0 C-0.99 0.33 -1.98 0.66 -3 1 C-4.20882096 3.00016466 -4.20882096 3.00016466 -5 5 C-5.99 4.67 -6.98 4.34 -8 4 C-8 3.01 -8 2.02 -8 1 C-2.25 -1.125 -2.25 -1.125 0 0 Z " fill="#0E0E0E" transform="translate(91,171)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
<path d="" fill="#FFFFFF" transform="translate(0,0)"/>
</svg>
)}
        </button>
      </div>

      {/* Directions Panel */}
      {hasRoute && steps.length > 0 && (
        <div className="directions-panel">
          {isNavigating && steps[activeStepIndex] && (
            <div className="next-maneuver-banner">
              <Navigation size={16} />
              <span>{steps[activeStepIndex].text}</span>
              {nextStepDistance !== null && (
                <strong>{formatDistance(nextStepDistance)}</strong>
              )}
            </div>
          )}
          <h4>Directions</h4>
          <div className="directions-actions">
            {!isNavigating ? (
              <button
                type="button"
                className="nav-btn start"
                onClick={startNavigation}
              >
                Start Navigation
              </button>
            ) : (
              <button
                type="button"
                className="nav-btn stop"
                onClick={stopNavigation}
              >
                Stop Navigation
              </button>
            )}
          </div>
          <ol>
            {steps.map((s, i) => (
              <li
                key={i}
                className={`step-item ${
                  isNavigating && i === activeStepIndex ? "active" : ""
                }`}
                onClick={() => focusStep(i)}
              >
                {isNavigating && i === activeStepIndex && (
                  <Navigation className="step-location-arrow current" size={15} />
                )}
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
      {isFocused &&
        (suggestions.length > 0 ||
          isLoadingSuggestions ||
          !!suggestionError ||
          debouncedQuery.trim().length >= 2) && (
        <ul className="map-search-suggestions">
          {isLoadingSuggestions && (
            <li className="map-suggestion-state">Searching places...</li>
          )}
          {!isLoadingSuggestions && suggestionError && (
            <li className="map-suggestion-state error">{suggestionError}</li>
          )}
          {!isLoadingSuggestions &&
            !suggestionError &&
            suggestions.length === 0 &&
            debouncedQuery.trim().length >= 2 && (
              <li className="map-suggestion-state">No places found</li>
            )}
          {suggestions.slice(0, 3).map((s, i) => {
            const [title, ...rest] = s.display_name.split(",");
            const subtitle = rest.join(", ").trim();
            return (
              <li
                key={i}
                onPointerDown={(e) => handleSuggestionPick(e, s)}
                onMouseDown={(e) => handleSuggestionPick(e, s)}
                onClick={(e) => handleSuggestionPick(e, s)}
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

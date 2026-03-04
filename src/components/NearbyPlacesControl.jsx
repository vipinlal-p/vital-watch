import React, { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { Shield, Hospital, Pill, X } from "lucide-react";
import "../styles/nearby-places.css";

// Fix default Leaflet marker icon in React builds
// eslint-disable-next-line no-underscore-dangle
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const CATEGORY_META = {
  hospital: { label: "Hospitals", icon: Hospital, query: 'node["amenity"="hospital"]' },
  police: { label: "Police Stations", icon: Shield, query: 'node["amenity"="police"]' },
  pharmacy: { label: "Medical Shops", icon: Pill, query: 'node["amenity"="pharmacy"]' },
};

export default function NearbyPlacesControl({
  userLocation,
  destination,
  nearbyRequest,
  clearRequestAt,
  onCategorySelected,
  onNearbyCleared,
}) {
  const map = useMap();
  const [hasResults, setHasResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");
  const [poiResults, setPoiResults] = useState([]);

  const controlRef = useRef(null);
  const poiMarkersRef = useRef([]);
  const bufferCircleRef = useRef(null);
  const markerByIdRef = useRef(new Map());

  useEffect(() => {
    const node = controlRef.current;
    if (!node) return;
    L.DomEvent.disableClickPropagation(node);
    L.DomEvent.disableScrollPropagation(node);
    L.DomEvent.on(node, "dblclick", L.DomEvent.stopPropagation);
    return () => {
      L.DomEvent.off(node, "dblclick", L.DomEvent.stopPropagation);
    };
  }, []);

  const hospitalIcon = L.divIcon({
    className: "custom-poi-icon hospital-icon",
    html: "H",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  const policeIcon = L.divIcon({
    className: "custom-poi-icon police-icon",
    html: "★",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  const pharmacyIcon = L.divIcon({
    className: "custom-poi-icon pharmacy-icon",
    html: "💊",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  const iconForCategory = (category) => {
    if (category === "hospital") return hospitalIcon;
    if (category === "police") return policeIcon;
    if (category === "pharmacy") return pharmacyIcon;
    return new L.Icon.Default();
  };

  const upsertResult = (nextItem) => {
    setPoiResults((prev) => {
      const index = prev.findIndex((item) => item.id === nextItem.id);
      if (index === -1) return [...prev, nextItem];
      const clone = [...prev];
      clone[index] = { ...clone[index], ...nextItem };
      return clone;
    });
  };

  const clearPOIs = () => {
    poiMarkersRef.current.forEach((m) => {
      if (map.hasLayer(m)) map.removeLayer(m);
    });
    poiMarkersRef.current = [];
    markerByIdRef.current.clear();

    if (bufferCircleRef.current && map.hasLayer(bufferCircleRef.current)) {
      map.removeLayer(bufferCircleRef.current);
      bufferCircleRef.current = null;
    }

    setPoiResults([]);
    setHasResults(false);
    setIsLoading(false);
    setActiveCategory("");
    onCategorySelected?.("");
    onNearbyCleared?.();
  };

  const addMarkerWithPopup = (id, lat, lon, name, category) => {
    const icon = iconForCategory(category);
    const marker = L.marker([lat, lon], { icon }).addTo(map);

    const coords = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    const fallbackTitle = name || "Unnamed place";

    marker.bindPopup(`<b>${fallbackTitle}</b><br/>${coords}`);

    poiMarkersRef.current.push(marker);
    markerByIdRef.current.set(id, marker);

    const baseResult = {
      id,
      title: fallbackTitle,
      address: coords,
      coords,
      lat,
      lon,
      resolved: false,
    };
    upsertResult(baseResult);

    (async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
        );
        const data = await res.json();
        const address = data?.display_name || coords;
        const shortAddress =
          data?.name ||
          data?.address?.suburb ||
          data?.address?.village ||
          data?.address?.town ||
          data?.address?.city ||
          fallbackTitle;

        marker.setPopupContent(`
          <div style="width: 260px; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial;">
            <h3 style="font-size: 1rem; margin:0 0 4px 0; font-weight:600;">${shortAddress}</h3>
            <p style="margin:0 0 8px 0; font-size:0.85rem; color:#555;">${address}</p>
            <a
              href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=16"
              target="_blank"
              rel="noopener noreferrer"
              style="text-decoration:underline; color:#2563eb; font-size:0.9rem;"
            >
              ${coords}
            </a>
          </div>
        `);

        upsertResult({
          id,
          title: shortAddress,
          address,
          resolved: true,
        });
      } catch {
        // keep fallback info
      }
    })();

    return marker;
  };

  const resolveBaseLocation = () => {
    return destination || userLocation;
  };

  const fetchPOIs = async (category, base) => {
    if (!base || !CATEGORY_META[category]) return;

    const [lat, lon] = base;
    const radius = 2500;
    const meta = CATEGORY_META[category];

    setIsLoading(true);
    setActiveCategory(meta.label);
    onCategorySelected?.(meta.label);

    clearPOIs();
    setActiveCategory(meta.label);
    onCategorySelected?.(meta.label);

    try {
      const url = `https://overpass-api.de/api/interpreter?data=[out:json];(${meta.query}(around:${radius},${lat},${lon}););out;`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Overpass API error ${res.status}`);
      const data = await res.json();
      const elements = Array.isArray(data.elements) ? data.elements : [];

      const circle = L.circle([lat, lon], {
        radius,
        color: "#2563eb",
        fillColor: "#2563eb",
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map);
      bufferCircleRef.current = circle;

      if (elements.length === 0) {
        setHasResults(true);
        setIsLoading(false);
        return;
      }

      const markers = [];
      for (let i = 0; i < elements.length; i += 1) {
        const el = elements[i];
        if (typeof el.lat !== "number" || typeof el.lon !== "number") continue;
        const marker = addMarkerWithPopup(
          `${category}-${el.id || `${el.lat}-${el.lon}`}`,
          el.lat,
          el.lon,
          el.tags?.name,
          category
        );
        markers.push(marker);
        setHasResults(true);
        // Add incrementally so results feel responsive instead of waiting for all.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 15));
      }

      if (markers.length > 0) {
        const group = L.featureGroup([...markers, circle]);
        map.fitBounds(group.getBounds(), { padding: [40, 40] });
      }
    } catch (err) {
      console.error("NearbyPlacesControl error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const category = nearbyRequest?.category;
    if (!category) return;
    const base = resolveBaseLocation();
    if (!base) return;
    fetchPOIs(category, base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearbyRequest?.requestedAt]);

  useEffect(() => {
    if (!clearRequestAt) return;
    clearPOIs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearRequestAt]);

  const focusResult = (item) => {
    const marker = markerByIdRef.current.get(item.id);
    if (!marker) return;
    map.setView([item.lat, item.lon], 15, { animate: true });
    marker.openPopup();
  };

  return (
    <div className="poi-wrapper" ref={controlRef}>
      {(isLoading || hasResults) && (
        <div className="poi-side-panel">
          <div className="poi-panel-header">
            <div>
              <div className="poi-panel-title">{activeCategory || "Nearby Places"}</div>
              <div className="poi-panel-sub">
                {isLoading ? "Loading results..." : `${poiResults.length} result(s)`}
              </div>
            </div>
            <button className="poi-clear-btn" onClick={clearPOIs} title="Close nearby results">
              <X size={16} />
            </button>
          </div>

          <div className="poi-result-list">
            {poiResults.length === 0 && isLoading ? (
              <div className="poi-result-empty">Fetching places one by one...</div>
            ) : null}

            {poiResults.length === 0 && !isLoading ? (
              <div className="poi-result-empty">No places found in this area.</div>
            ) : null}

            {poiResults.map((item) => (
              <button
                key={item.id}
                className="poi-result-item"
                onClick={() => focusResult(item)}
                title="Focus this place on map"
              >
                <div className="poi-result-name">{item.title}</div>
                <div className="poi-result-addr">{item.address}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

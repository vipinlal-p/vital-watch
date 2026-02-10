// src/components/CurrentLocationMarker.jsx
import React, { useEffect, useState } from "react";
import { Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "../styles/current-location.css";

// Custom blue dot (Google Maps–like but open source)
const blueDotIcon = L.divIcon({
    className: "custom-location-icon",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
});

function CurrentLocationMarker() {
    const [position, setPosition] = useState(null);
    const [address, setAddress] = useState("Fetching address...");
    const [shortAddress, setShortAddress] = useState("");
    const map = useMap();

    useEffect(() => {
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                const coords = [latitude, longitude];
                setPosition(coords);

                // ❌ Removed map.setView() → no auto-centering

                // Fetch address via OSM Nominatim
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
                    );
                    const data = await res.json();
                    if (data) {
                        setAddress(data.display_name || "Unknown location");

                        const short =
                            data.name ||
                            data.address?.suburb ||
                            data.address?.village ||
                            data.address?.town ||
                            data.address?.city ||
                            "Unknown place";
                        const postcode = data.address?.postcode
                            ? `, ${data.address.postcode}`
                            : "";
                        setShortAddress(`${short}${postcode}`);
                    }
                } catch (err) {
                    console.error("Reverse geocoding failed:", err);
                    setAddress("Unable to fetch address");
                }
            },
            (err) => {
                console.error("Geolocation error:", err);
            }
        );
    }, [map]);

    return position ? (
        <Marker position={position} icon={blueDotIcon}>
            <Popup>
                <div className="w-64">
                    <h2 className="font-semibold text-gray-900">
                        {shortAddress || "Your Location"}
                    </h2>
                    <p className="text-sm text-gray-600 mb-2">{address}</p>
                    <a
                        href={`https://www.openstreetmap.org/?mlat=${position[0]}&mlon=${position[1]}&zoom=16`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 font-medium hover:underline"
                    >
                        {position[0].toFixed(6)}, {position[1].toFixed(6)}
                    </a>
                </div>
            </Popup>
        </Marker>
    ) : null;
}

export default CurrentLocationMarker;

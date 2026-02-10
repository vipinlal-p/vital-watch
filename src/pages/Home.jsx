// src/pages/Home.jsx
import React, { useState, useEffect, useCallback } from "react";
import { MapContainer, useMap, ScaleControl } from "react-leaflet"; // ✅ import ScaleControl
import "leaflet/dist/leaflet.css";
import "../styles/map-controls.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

import MapLayersToggle from "/src/components/MapLayersToggle";
import ZoomControlButton from "/src/components/ZoomControlButton";
import LocateControlButton from "/src/components/LocateControlButton";
import CurrentLocationMarker from "/src/components/CurrentLocationMarker";
import InsetMap from "/src/components/InsetMap";
import BoundaryDropdown from "../components/BoundaryDropdown";
import MeasureControl from "../components/MeasureControl";
import LocationMarkerControl from "/src/components/LocationMarkerControl";
import SearchBar from "../components/SearchBar";
import NearbyPlacesControl from "../components/NearbyPlacesControl";
import { useWindowSize, useDebounce } from "/src/hooks"; // ✅ use hooks from index.js
import CrimeLayer from "../components/CrimeLayer";
import HeatmapLayer from "../components/HeatmapLayer";
import TrendsLayer from "../components/TrendsLayer";
import AddCrimeData from "../components/AddCrimeData";

const MainMap = React.memo(
  ({ setBounds, setCenterZoom, activeBase, setActiveBase }) => {
    const map = useMap();

    const updateView = useCallback(() => {
      setBounds(map.getBounds());
      setCenterZoom({
        center: map.getCenter(),
        zoom: map.getZoom(),
      });
    }, [map, setBounds, setCenterZoom]);

    useEffect(() => {
      map.on("moveend zoomend", updateView);
      updateView(); // initial
      return () => {
        map.off("moveend zoomend", updateView);
      };
    }, [map, updateView]);

    return (
      <>
        <MapLayersToggle
          activeBase={activeBase}
          setActiveBase={setActiveBase}
        />
        <ZoomControlButton />
        <LocateControlButton />
        {/* ✅ Scale control bottom-left */}
        <ScaleControl position="bottomleft" metric={true} imperial={false} />
      </>
    );
  }
);

function Home() {
  const position = [10.012, 76.5573]; // Kochi default
  const [bounds, setBounds] = useState(null);
  const [centerZoom, setCenterZoom] = useState({ center: position, zoom: 8 });
  const [isInsetVisible, setIsInsetVisible] = useState(true);
  const [width] = useWindowSize(); // ✅ external hook
  const debouncedBounds = useDebounce(bounds, 100); // ✅ external hook
  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState(null);

  const [activeBase, setActiveBase] = useState("osm");

  const insetSize = width < 640 ? 160 : width < 1024 ? 200 : 260;

  useEffect(() => {
    if (bounds) {
      setIsInsetVisible(true);
      const timer = setTimeout(() => setIsInsetVisible(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [bounds]);

  return (
    <div
      className="w-full relative z-0"
      style={{ height: "calc(100vh - 60px)" }} // adjust for Navbar
    >
      {/* Main Map */}
      <MapContainer
        center={position}
        zoom={10}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <MainMap
          setBounds={setBounds}
          setCenterZoom={setCenterZoom}
          activeBase={activeBase}
          setActiveBase={setActiveBase}
        />
        <CrimeLayer />
        <HeatmapLayer />
        <TrendsLayer />
        <AddCrimeData />
        <SearchBar
          onLocationChange={setUserLocation}
          onDestinationChange={setDestination}
        />

        <NearbyPlacesControl
          userLocation={userLocation}
          destination={destination}
        />
        <CurrentLocationMarker />
        <BoundaryDropdown />
        <MeasureControl />
        <LocationMarkerControl />
      </MapContainer>

      {/* Inset Map */}
      <InsetMap
        bounds={debouncedBounds}
        centerZoom={centerZoom}
        isVisible={isInsetVisible}
        insetSize={insetSize}
        activeBase={activeBase}
      />
    </div>
  );
}

export default Home;

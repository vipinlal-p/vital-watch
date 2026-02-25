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
import VectorLayers from "../components/VectorLayers";
import MeasureControl from "../components/MeasureControl";
import LocationMarkerControl from "/src/components/LocationMarkerControl";
import SearchBar from "../components/SearchBar";
import NearbyPlacesControl from "../components/NearbyPlacesControl";
import { useWindowSize, useDebounce } from "/src/hooks"; // ✅ use hooks from index.js
import CrimeLayer from "../components/CrimeLayer";
import HeatmapLayer from "../components/HeatmapLayer";
import TrendsLayer from "../components/TrendsLayer";
import RaterLayers from "../components/RaterLayers";

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
  const position = [8.5241, 76.9366]; // Trivandrum default
  const [bounds, setBounds] = useState(null);
  const [centerZoom, setCenterZoom] = useState({ center: position, zoom: 8 });
  const [isInsetVisible, setIsInsetVisible] = useState(true);
  const [width] = useWindowSize(); // ✅ external hook
  const debouncedBounds = useDebounce(bounds, 100); // ✅ external hook
  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [layerPanel, setLayerPanel] = useState(null);
  const [rasterLegendItems, setRasterLegendItems] = useState([]);
  const [vectorLegendItems, setVectorLegendItems] = useState([]);

  const [activeBase, setActiveBase] = useState("osm");

  const insetSize = width < 640 ? 160 : width < 1024 ? 200 : 260;
  const sharedLayerPanelStyle = { top: "124px", left: "12px", width: "270px" };

  useEffect(() => {
    if (bounds) {
      setIsInsetVisible(true);
      const timer = setTimeout(() => setIsInsetVisible(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [bounds]);

  const hasLegendItems =
    rasterLegendItems.length > 0 || vectorLegendItems.length > 0;
  const formatLegendName = (name) => String(name || "").replace(/^[^:]+:/, "");

  return (
    <div
      className="w-full relative z-0"
      style={{ height: "calc(100vh - 60px)" }} // adjust for Navbar
    >
      {/* Main Map */}
      <div className="layer-split-control" style={{ top: "80px", left: "12px" }}>
        <button
          className={`layer-split-btn ${layerPanel === "vector" ? "active" : ""}`}
          onClick={() =>
            setLayerPanel((prev) => (prev === "vector" ? null : "vector"))
          }
        >
          Vector Layers
        </button>
        <button
          className={`layer-split-btn ${layerPanel === "raster" ? "active" : ""}`}
          onClick={() =>
            setLayerPanel((prev) => (prev === "raster" ? null : "raster"))
          }
        >
          Raster Layers
        </button>
      </div>

      <MapContainer
        center={position}
        zoom={10}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        doubleClickZoom={false}
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
        <RaterLayers
          hideToggle={true}
          externallyOpen={layerPanel === "raster"}
          containerStyle={sharedLayerPanelStyle}
          onLegendChange={setRasterLegendItems}
        />
        <SearchBar
          onLocationChange={setUserLocation}
          onDestinationChange={setDestination}
        />

        <NearbyPlacesControl
          userLocation={userLocation}
          destination={destination}
        />
        <CurrentLocationMarker />
        <VectorLayers
          hideToggle={true}
          externallyOpen={layerPanel === "vector"}
          containerStyle={sharedLayerPanelStyle}
          onLegendChange={setVectorLegendItems}
        />
        <MeasureControl />
        <LocationMarkerControl />
      </MapContainer>

      {hasLegendItems && (
        <div className="map-shared-legend">
          <div className="map-shared-legend-header">Legend</div>

          {rasterLegendItems.length > 0 && (
            <div className="map-shared-legend-section">
              <div className="map-shared-legend-title">Raster Layers</div>
              {rasterLegendItems.map((item) => (
                <div className="map-shared-legend-item" key={`r-${item.id}`}>
                  <img
                    className="map-shared-legend-image"
                    src={item.imageUrl}
                    alt={`${item.name} legend`}
                  />
                  <span className="map-shared-legend-name">
                    {formatLegendName(item.name)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {vectorLegendItems.length > 0 && (
            <div className="map-shared-legend-section">
              <div className="map-shared-legend-title">Vector Layers</div>
              {vectorLegendItems.map((item) => (
                <div className="map-shared-legend-item" key={`v-${item.id}`}>
                  <span
                    className="map-shared-legend-swatch"
                    style={{ backgroundColor: item.color || "#ff7800" }}
                  />
                  <span className="map-shared-legend-name">{item.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

// src/pages/Home.jsx
import React, { useState, useEffect, useCallback } from "react";
import { MapContainer, useMap, ScaleControl } from "react-leaflet"; // ✅ import ScaleControl
import "leaflet/dist/leaflet.css";
import "../styles/map-controls.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

import MapLayersToggle from "/src/components/MapLayersToggle";
import ZoomControlButton from "/src/components/ZoomControlButton";
import LocateControlButton from "/src/components/LocateControlButton";
import CurrentLocationMarker from "/src/components/CurrentLocationMarker";
import VectorLayers from "../components/VectorLayers";
import MeasureControl from "../components/MeasureControl";
import LocationMarkerControl from "/src/components/LocationMarkerControl";
import SearchBar from "../components/SearchBar";
import NearbyPlacesControl from "../components/NearbyPlacesControl";
import DiseaseLayer from "../components/DiseaseLayer";
import HeatmapLayer from "../components/HeatmapLayer";
import TrendsLayer from "../components/TrendsLayer";
import RasterLayers from "../components/RasterLayers";
import FloatingAuthControl from "../components/FloatingAuthControl";

const RASTER_NORMALIZED_CLASSES = [
  { id: "very-low", label: "Very Low (0-20%)", color: "#15803d" },
  { id: "low", label: "Low (20-40%)", color: "#65a30d" },
  { id: "moderate", label: "Moderate (40-60%)", color: "#facc15" },
  { id: "high", label: "High (60-80%)", color: "#f97316" },
  { id: "very-high", label: "Very High (80-100%)", color: "#dc2626" },
];

const MainMap = React.memo(
  ({ setBounds, activeBase, setActiveBase }) => {
    const map = useMap();

    const updateView = useCallback(() => {
      setBounds(map.getBounds());
    }, [map, setBounds]);

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
  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [nearbyRequest, setNearbyRequest] = useState(null);
  const [nearbySearchText, setNearbySearchText] = useState("");
  const [nearbyActive, setNearbyActive] = useState(false);
  const [nearbyClearAt, setNearbyClearAt] = useState(0);
  const [activeLayerMenu, setActiveLayerMenu] = useState(null);
  const [rasterLegendItems, setRasterLegendItems] = useState([]);
  const [vectorLegendItems, setVectorLegendItems] = useState([]);

  const [activeBase, setActiveBase] = useState("satellite");

  const sharedLayerPanelStyle = {
    top: "calc(112px + var(--navbar-offset))",
    left: "12px",
    width: "270px",
  };

  const hasLegendItems =
    rasterLegendItems.length > 0 || vectorLegendItems.length > 0;
  const formatLegendName = (name) => String(name || "").replace(/^[^:]+:/, "");

  return (
    <div
      className="w-full relative z-0"
      style={{ height: "100vh" }}
    >
      <MapContainer
        center={position}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        doubleClickZoom={false}
      >
        <MainMap
          setBounds={() => {}}
          activeBase={activeBase}
          setActiveBase={setActiveBase}
        />
        <DiseaseLayer
          hideToggle={true}
          externallyOpen={activeLayerMenu === "disease-layer"}
          containerStyle={sharedLayerPanelStyle}
          onRequestClose={() => setActiveLayerMenu(null)}
        />
        <HeatmapLayer
          hideToggle={true}
          externallyOpen={activeLayerMenu === "disease-heatmap"}
          containerStyle={sharedLayerPanelStyle}
          onRequestClose={() => setActiveLayerMenu(null)}
        />
        <TrendsLayer
          hideToggle={true}
          externallyOpen={activeLayerMenu === "disease-trends"}
          onRequestClose={() => setActiveLayerMenu(null)}
        />
        <RasterLayers
          hideToggle={true}
          externallyOpen={activeLayerMenu === "raster"}
          containerStyle={sharedLayerPanelStyle}
          onLegendChange={setRasterLegendItems}
          onRequestClose={() => setActiveLayerMenu(null)}
        />
        <SearchBar
          onLocationChange={setUserLocation}
          onDestinationChange={setDestination}
          onNearbyRequest={(category) => {
            setNearbyActive(true);
            setNearbyRequest({ category, requestedAt: Date.now() });
          }}
          onClearNearby={() => {
            setNearbyActive(false);
            setNearbySearchText("");
            setNearbyClearAt(Date.now());
          }}
          nearbyActive={nearbyActive}
          externalQueryText={nearbySearchText}
        />

        <NearbyPlacesControl
          userLocation={userLocation}
          destination={destination}
          nearbyRequest={nearbyRequest}
          clearRequestAt={nearbyClearAt}
          onCategorySelected={(label) => {
            setNearbySearchText(label);
            setNearbyActive(Boolean(label));
          }}
          onNearbyCleared={() => {
            setNearbyActive(false);
            setNearbySearchText("");
          }}
        />
        <CurrentLocationMarker />
        <VectorLayers
          hideToggle={true}
          externallyOpen={activeLayerMenu === "vector"}
          containerStyle={sharedLayerPanelStyle}
          onLegendChange={setVectorLegendItems}
          onRequestClose={() => setActiveLayerMenu(null)}
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
              {RASTER_NORMALIZED_CLASSES.map((item) => (
                <div className="map-shared-legend-item" key={`r-${item.id}`}>
                  <span
                    className="map-shared-legend-swatch"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="map-shared-legend-name">{item.label}</span>
                </div>
              ))}
              <div className="map-shared-legend-note">
                Five-class raster style from GeoServer (`raster_5class`).
              </div>
              {rasterLegendItems.map((item) => (
                <div className="map-shared-legend-item" key={`rl-${item.id}`}>
                  <span className="map-shared-legend-name">
                    Layer: {formatLegendName(item.name)}
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

      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: "14px",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "transparent",
          borderRadius: "24px",
          padding: "6px 14px",
          boxShadow: "none",
          zIndex: 3000,
          pointerEvents: "none",
        }}
      >
        <img
          src="/logo.png"
          alt="Vital Watch logo"
          style={{
            width: "28px",
            height: "28px",
            filter:
              "drop-shadow(0.3px 0 0 #fff) drop-shadow(-0.3px 0 0 #fff) drop-shadow(0 0.3px 0 #fff) drop-shadow(0 -0.3px 0 #fff) drop-shadow(0.3px 0.3px 0 #fff) drop-shadow(-0.3px -0.3px 0 #fff) drop-shadow(0.3px -0.3px 0 #fff) drop-shadow(-0.3px 0.3px 0 #fff)",
          }}
        />
        <span
          style={{
            color: "#5f6368",
            fontSize: "24px",
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "-1.2px",
            fontFamily: "Arial, Helvetica, sans-serif",
            WebkitTextStroke: "2px #ffffff",
            paintOrder: "stroke fill",
            textShadow: "none",
          }}
        >
          Vital Watch
        </span>
      </div>

      <FloatingAuthControl
        layerMenuValue={activeLayerMenu}
        onLayerMenuChange={(key) =>
          setActiveLayerMenu((prev) => (prev === key ? null : key))
        }
      />
    </div>
  );
}

export default Home;

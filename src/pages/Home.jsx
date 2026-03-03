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
  const [activeLayerMenu, setActiveLayerMenu] = useState(null);
  const [rasterLegendItems, setRasterLegendItems] = useState([]);
  const [vectorLegendItems, setVectorLegendItems] = useState([]);

  const [activeBase, setActiveBase] = useState("osm");

  const sharedLayerPanelStyle = { top: "112px", left: "12px", width: "270px" };

  const hasLegendItems =
    rasterLegendItems.length > 0 || vectorLegendItems.length > 0;
  const formatLegendName = (name) => String(name || "").replace(/^[^:]+:/, "");

  return (
    <div
      className="w-full relative z-0"
      style={{ height: "calc(100vh - 60px)" }} // adjust for Navbar
    >
      <MapContainer
        center={position}
        zoom={10}
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
        />
        <HeatmapLayer
          hideToggle={true}
          externallyOpen={activeLayerMenu === "disease-heatmap"}
          containerStyle={sharedLayerPanelStyle}
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
        />
        <SearchBar
          onLocationChange={setUserLocation}
          onDestinationChange={setDestination}
          onNearbyRequest={(category) =>
            setNearbyRequest({ category, requestedAt: Date.now() })
          }
          layerMenuValue={activeLayerMenu}
          onLayerMenuChange={(key) =>
            setActiveLayerMenu((prev) => (prev === key ? null : key))
          }
        />

        <NearbyPlacesControl
          userLocation={userLocation}
          destination={destination}
          nearbyRequest={nearbyRequest}
          hideToggle={true}
        />
        <CurrentLocationMarker />
        <VectorLayers
          hideToggle={true}
          externallyOpen={activeLayerMenu === "vector"}
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
    </div>
  );
}

export default Home;

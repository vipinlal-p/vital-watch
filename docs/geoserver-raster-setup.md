# GeoServer Raster Setup

This project now expects raster layers through WMS and displays them from the map control named **Raster Layers**.

## 1. Start GeoServer (Docker)

```bash
cd infrastructure/geoserver
docker compose up -d
```

Open GeoServer:
- URL: `http://localhost:8080/geoserver`
- User: `admin`
- Password: `geoserver`

## 2. Add raster files

Copy your GeoTIFF files into:
- `infrastructure/geoserver/rasters/`

Examples:
- `dem.tif`
- `aspect.tif`
- `population_density.tif`

## 3. Publish layers in GeoServer

In GeoServer UI:

1. Create workspace `raster`.
2. Create a store for each GeoTIFF from `/opt/geoserver/rasters`.
3. Publish each layer (name can be anything).
4. Ensure each layer has native SRS and valid bounds (Compute from native bounds).

## 4. Use in the map

The **Raster Layers** panel now:
- Loads all available WMS layers from `GetCapabilities`.
- Lets users search and enable any raster layer.
- Allows manual add (`workspace:layer`) if catalog loading fails or layer is hidden.
- Checks CRS support before visualization.

Projection handling:
- Map CRS is read from Leaflet (project default: `EPSG:3857`).
- If a layer supports map CRS, it uses that.
- If not, it falls back to `EPSG:3857`, then `EPSG:4326`.
- If none are supported, layer is not added and an error is shown.

## 5. Optional frontend overrides

Create/update `.env` in project root:

```bash
VITE_GEOSERVER_WMS_URL=http://localhost:8080/geoserver/wms
VITE_GEOSERVER_DEM_LAYER=raster:dem
VITE_GEOSERVER_ASPECT_LAYER=raster:aspect
VITE_GEOSERVER_POPULATION_LAYER=raster:population_density
```

Restart Vite after updating `.env`.

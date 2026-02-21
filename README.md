# VectorWatch

Interactive web GIS with:
- Base map switcher
- Vector layer management (local files + uploaded shapefile/GeoJSON)
- Raster layer management from GeoServer WMS
- Search, nearby places, directions, measurement, and trends/crime overlays

## Stack
- Frontend: React + Vite + Leaflet (`http://localhost:5173`)
- Backend: Express (`http://localhost:5000`)
- Database: PostGIS (`localhost:5432`)
- GeoServer: WMS source for raster layers (`http://localhost:8080/geoserver`)

## Run With Docker (Recommended)

From project root:

```bash
docker compose up --build
```

If your machine only supports legacy command:

```bash
docker-compose up --build
```

Run detached:

```bash
docker compose up --build -d
# or
docker-compose up --build -d
```

Stop services:

```bash
docker compose down
# or
docker-compose down
```

## Services In Docker
- `frontend` container: Vite dev server
- `backend` container: Express API
- `db` container: PostGIS
- `geoserver` container: GeoServer + mounted raster folder

Persistent volumes:
- `postgres_data`
- `geoserver_data`

Mounted raster input folder:
- `infrastructure/geoserver/rasters/` -> `/opt/geoserver/rasters` (read-only in container)

## Raster Layer Workflow (GeoServer)

1. Put georeferenced rasters (`.tif`, etc.) in:
   - `infrastructure/geoserver/rasters/`
2. Open GeoServer:
   - `http://localhost:8080/geoserver`
   - default user/pass in compose: `admin` / `geoserver`
3. In GeoServer UI:
   - create workspace `raster` (or your configured workspace)
   - create a store for each raster from `/opt/geoserver/rasters`
   - publish each layer and compute native bounds
4. In app:
   - open **Raster Layers**
   - layers are auto-loaded from `GetCapabilities`
   - enable/disable layers and adjust opacity

CRS behavior:
- Map default stays in Web Mercator (`EPSG:3857`)
- Raster panel chooses CRS supported by both map/layer
- fallback order: map CRS -> `EPSG:3857` -> `EPSG:4326`

## Vector Layer Workflow

- Built-in vectors auto-populate from `src/data/*.{json,geojson}`
- You can upload:
  - zipped shapefile (`.zip`)
  - `.geojson` / `.json`
- Uploaded vectors are normalized and rendered on map
- Basic CRS inference/reprojection is applied for common cases (`EPSG:4326` and likely `EPSG:3857` inputs)

## Layer UI

- Split control at top-left:
  - **Vector Layers**
  - **Raster Layers**
- Only one dropdown is open at a time
- Shared map legend appears at bottom-left above the scale bar

## Environment Variables

Copy `.env.example` to `.env` if you want overrides.

Important vars used by frontend:
- `VITE_API_BASE_URL`
- `VITE_GEOSERVER_BASE_URL`
- `VITE_GEOSERVER_WMS_URL`
- `VITE_GEOSERVER_OWS_URL`
- `VITE_GEOSERVER_WORKSPACE`
- `VITE_GEOSERVER_DEM_LAYER`
- `VITE_GEOSERVER_ASPECT_LAYER`
- `VITE_GEOSERVER_POPULATION_LAYER`

## Common Issues

### `Cannot start service geoserver ... port 8080 already in use`
Another process is already bound to `8080` (often local GeoServer/Tomcat).

Fix options:
- Stop the process using `8080`, then restart docker compose.
- Or remap geoserver port in `docker-compose.yml` (for example `8081:8080`) and update frontend env URLs accordingly.

### `unknown shorthand flag: 'd' in -d`
You likely ran `docker -d ...` directly. Use:

```bash
docker compose up -d
```

or:

```bash
docker-compose up -d
```

### `Could not load layer catalog`
Usually one of:
- GeoServer not running
- wrong WMS URL
- workspace mismatch (`VITE_GEOSERVER_WORKSPACE`)
- no published layers in that workspace

## Project Notes

- Component file is currently named `src/components/RaterLayers.jsx` (UI label is **Raster Layers**).
- Raster source rasters in `infrastructure/geoserver/rasters/` are ignored by `.gitignore` for common local file types; keep committed seed files only if intentionally tracked.

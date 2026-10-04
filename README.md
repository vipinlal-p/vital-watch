# 🗺️ VitalWatch

**An interactive web GIS platform for visualizing and analyzing geospatial data.**

> This project provides a full-stack solution for managing and displaying vector and raster layers, with tools for search, analysis, and more.

---

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React-blue?logo=react" alt="Frontend: React">
  <img src="https://img.shields.io/badge/Backend-Express-lightgrey?logo=express" alt="Backend: Express">
  <img src="https://img.shields.io/badge/Database-PostGIS-blue?logo=postgresql" alt="Database: PostGIS">
  <img src="https://img.shields.io/badge/GIS-Leaflet-green?logo=leaflet" alt="GIS: Leaflet">
  <img src="https://img.shields.io/badge/Contributions-Welcome-orange" alt="Contributions Welcome">
</p>

---

## 🎓 Academic Project

This project has been developed as the **Dissertation/Project Work** for the **M.Sc. Geoinformatics (MSCGI) Programme, Project MGYP-031**, under **Indira Gandhi National Open University (IGNOU)**.

### Student Details

- **Name:** Vipinlal P
- **Enrolment Number:** 2450132320
- **Regional Centre:** RC Trivandrum (40)
- **Study Centre:** Institute of Land and Disaster Management

### Supervisor

**Sri. Amalraj M**  
*Assistant Professor*  
*Institute of Land and Disaster Management*

---

## ✨ Features

-   **Interactive Map:** A fast, responsive map interface powered by Leaflet.
-   **Base Map Switcher:** Toggle between multiple base layers like OpenStreetMap, Satellite, and Dark Mode.
-   **Vector Layer Management:**
    -   Load vector data from local project files.
    -   Upload user-provided Shapefiles (.zip) and GeoJSON files.
    -   Client-side reprojection for common CRS.
-   **Raster Layer Management:**
    -   Dynamically load and display raster layers from a GeoServer WMS instance.
    -   Adjust layer opacity.
-   **GIS Tools:**
    -   **Search:** Find locations and points of interest.
    -   **Nearby Places:** Discover what's around a given point.
    -   **Directions:** Get routing between two points.
    -   **Measurement:** Measure distances and areas on the map.
-   **Data Overlays:**
    -   Display disease data and trends.
    -   Heatmap visualizations.
-   **User Accounts & Admin Controls:**
    -   Default seeded admin account on fresh DB initialization.
    -   Admin-managed user creation and role management.
    -   User self-service password change after login.
    -   User lifecycle actions: soft delete, restore, and permanent delete.
    -   Audit trail for user add/remove actions.

## 🛠️ Tech Stack

| Category | Technology |
| :--- | :--- |
| **Frontend** | [React](https://react.dev/), [Vite](https://vitejs.dev/), [Leaflet](https://leafletjs.com/), [Tailwind CSS](https://tailwindcss.com/) |
| **Backend** | [Node.js](https://nodejs.org/), [Express](https://expressjs.com/) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) + [PostGIS](https://postgis.net/) extension |
| **GeoServer** | [GeoServer](https://geoserver.org/) (via Docker) |
| **Container** | [Docker](https://www.docker.com/) |

## 🚀 Getting Started

This project is designed to be run with Docker. Ensure you have Docker and Docker Compose installed on your system.

1. **Clone the repository:**

   ```bash
   git clone https://github.com/vipinlal-p/vital-watch.git
   cd vital-watch
   ```

2. **Build and run the services:**

   From the project root, run the following command:

   ```bash
   docker compose up --build
   ```

   > **Note:** If you are using an older version of Docker Compose, you may need to use the hyphenated command: `docker-compose up --build`.

3. **Access the services:**

   - **Frontend Application:** [http://localhost:5173](http://localhost:5173)
   - **Backend API:** `http://localhost:5000`
   - **GeoServer:** [http://localhost:8080/geoserver](http://localhost:8080/geoserver)
   - **Database (PostGIS):** Connect on port `5432`

### 🔐 Default Admin Account

On a fresh database initialization, a default admin user is seeded automatically:

- **Username:** `admin`
- **Password:** `Admin@123`
- **Role:** `admin`

Use this account to sign in and create additional users from the Admin Panel (`/admin`).

> **Important:** Change or replace this default admin credential immediately in production deployments.
>
> **Note:** Database init scripts run only on first initialization of a fresh Postgres volume.  
> If you already have existing DB data, recreate the DB volume to re-run seed scripts.

### 👤 User Management Flow

- Users can be created only by admins from the Admin Panel.
- Logged-in users can change their own password from the profile dropdown.
- Admins can:
  - Soft delete users (account disabled, row retained)
  - Restore soft-deleted users
  - Permanently delete users
- Soft-deleted users cannot log in until restored.
- Add/remove actions are stored in the user audit log visible in Admin Panel.

### Useful Docker Commands

- **Run in detached mode:**

  ```bash
  docker compose up --build -d
  ```

- **Stop all services:**

  ```bash
  docker compose down
  ```

## ⚙️ Configuration

You can customize the application by creating a `.env` file in the project root. Copy the example file to get started:

```bash
cp .env.example .env
```

The following table describes the key environment variables for the frontend:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | URL for the backend Express API. | `http://localhost:5000` |
| `VITE_GEOSERVER_BASE_URL` | Base URL for the GeoServer instance. | `http://localhost:8080` |
| `VITE_GEOSERVER_WMS_URL` | The WMS endpoint for fetching raster tiles. | `http://localhost:8080/geoserver/wms` |
| `VITE_GEOSERVER_WORKSPACE` | The GeoServer workspace where raster layers are stored. | `raster` |

## 🤔 Common Issues

### Port 8080 is already in use

This error means another process (often a local Tomcat or another GeoServer instance) is using port 8080.

**Solution:** Stop the other process, or remap the port in `docker-compose.yml`. For example, change `8080:8080` to `8081:8080` and update the `VITE_GEOSERVER_...` URLs in your `.env` file.

### `Could not load layer catalog`

This usually indicates a problem with the GeoServer connection. Check the following:

- Is the `geoserver` container running? (`docker ps`)
- Is the `VITE_GEOSERVER_WMS_URL` correct?
- Does the workspace specified in `VITE_GEOSERVER_WORKSPACE` exist on GeoServer?
- Have you published any layers within that workspace?

## 📝 Project Notes

- Raster files (`.tif`) placed in `infrastructure/geoserver/rasters/` are processed by a startup script to automatically publish them to GeoServer.
- The `.gitignore` file is configured to ignore most common raster file types in that directory. If you want to commit a new "seed" raster, you may need to force-add it with `git add -f`.
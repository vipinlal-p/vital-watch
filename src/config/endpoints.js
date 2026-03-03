const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const GEOSERVER_BASE_URL =
  import.meta.env.VITE_GEOSERVER_BASE_URL || "http://localhost:8080";

export const GEOSERVER_WMS_URL =
  import.meta.env.VITE_GEOSERVER_WMS_URL ||
  `${GEOSERVER_BASE_URL}/geoserver/wms`;

export const apiUrl = (path) =>
  `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

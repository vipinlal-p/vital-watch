CREATE TABLE police_stations (
    station_id SERIAL PRIMARY KEY,
    district VARCHAR(100),
    subdivision VARCHAR(100),
    station_name VARCHAR(100),
    geom geometry(Point, 4326) -- ✅ geometry instead of geography
);

CREATE INDEX idx_police_geom ON police_stations USING GIST (geom);

INSERT INTO police_stations (district, subdivision, station_name, geom)
SELECT DISTINCT district, subdivision, police_station,
       ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
FROM staging_crimes;

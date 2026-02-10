CREATE TABLE crime_records (
    crime_id SERIAL PRIMARY KEY,
    station_id INT REFERENCES police_stations(station_id) ON DELETE CASCADE,
    crime_type VARCHAR(100),
    year INT,
    crime_count INT
);

INSERT INTO crime_records (station_id, crime_type, year, crime_count)
SELECT ps.station_id, sc.crime_type, sc.year, sc.crime_count
FROM staging_crimes sc
JOIN police_stations ps
  ON TRIM(LOWER(ps.station_name)) = TRIM(LOWER(sc.police_station))
 AND TRIM(LOWER(ps.district)) = TRIM(LOWER(sc.district))
 AND TRIM(LOWER(ps.subdivision)) = TRIM(LOWER(sc.subdivision))
 AND ST_X(ps.geom) = sc.longitude
 AND ST_Y(ps.geom) = sc.latitude;


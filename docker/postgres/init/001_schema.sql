CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  gender VARCHAR(20),
  dob DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS police_stations (
  station_id SERIAL PRIMARY KEY,
  district VARCHAR(100),
  subdivision VARCHAR(100),
  station_name VARCHAR(100),
  geom geometry(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_police_geom ON police_stations USING GIST (geom);

CREATE TABLE IF NOT EXISTS crime_records (
  crime_id SERIAL PRIMARY KEY,
  station_id INT REFERENCES police_stations(station_id) ON DELETE CASCADE,
  crime_type VARCHAR(100),
  year INT,
  crime_count INT
);

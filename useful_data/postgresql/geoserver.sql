SELECT
  ps.station_id,
  ps.station_name AS police_station,
  ps.district,
  ps.subdivision,
  cr.year,
  cr.crime_type,
  cr.crime_count,
  agg.total_crimes,
  ps.geom
FROM police_stations ps
LEFT JOIN crime_records cr
  ON ps.station_id = cr.station_id
LEFT JOIN (
  SELECT station_id, SUM(crime_count) AS total_crimes
  FROM crime_records
  GROUP BY station_id
) agg
  ON ps.station_id = agg.station_id

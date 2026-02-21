// db.js
import knex from "knex";

export const db = knex({
  client: "pg",
  connection: {
    host: process.env.PGHOST || "localhost",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
    database: process.env.PGDATABASE || "crime_map_db",
    port: Number(process.env.PGPORT || 5432),
  },
});

// db.js
import knex from "knex";

export const db = knex({
  client: "pg",
  connection: {
    host: "localhost", // or "localhost"
    user: "postgres", // e.g. "postgres"
    password: "2710",
    database: "crime_map_db", // ✅ your database name
    port: 5432, // default Postgres port
  },
});

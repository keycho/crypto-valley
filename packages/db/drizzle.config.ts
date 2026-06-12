import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration. Reads DATABASE_URL from the environment
 * (see .env.example and docker-compose.yml). No schema yet — this is config
 * only; the schema and the initial migration are generated in P1.
 */
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@localhost:5432/crypto_valley",
  },
});

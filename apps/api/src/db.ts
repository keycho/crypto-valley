import { createDb, createPool, type Database } from "@crypto-valley/db";

let cached: Database | undefined;

/** Lazily-created shared Drizzle handle for the API process. */
export function db(): Database {
  cached ??= createDb(createPool());
  return cached;
}

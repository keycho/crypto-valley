import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

import * as schema from "./schema";

/** Matches docker-compose.yml; used when DATABASE_URL is not set. */
export const DEFAULT_DATABASE_URL =
  "postgres://postgres:postgres@localhost:5432/crypto_valley";

export type Database = NodePgDatabase<typeof schema>;

/** The transaction handle passed to the economy helpers. */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export function createPool(config: PoolConfig = {}): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    ...config,
  });
}

export function createDb(pool: Pool): Database {
  return drizzle(pool, { schema });
}

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { type Database, DEFAULT_DATABASE_URL } from "./client";
import * as schema from "./schema";

export interface TestDb {
  db: Database;
  pool: Pool;
  schemaName: string;
  cleanup: () => Promise<void>;
}

const migrationsDir = fileURLToPath(new URL("../drizzle", import.meta.url));

function readMigrationStatements(): string[] {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const statements: string[] = [];
  for (const file of files) {
    // Drizzle qualifies FK targets as "public".*; strip it so every reference
    // resolves through the pool's search_path into the throwaway schema instead.
    const text = readFileSync(join(migrationsDir, file), "utf8").replaceAll('"public".', "");
    for (const part of text.split("--> statement-breakpoint")) {
      const trimmed = part.trim();
      if (trimmed.length > 0) statements.push(trimmed);
    }
  }
  return statements;
}

/**
 * Spins up an isolated, throwaway Postgres schema, applies the committed
 * migrations into it, and returns a Drizzle handle scoped to that schema (the
 * pool's search_path points at it). Call `cleanup()` to drop it.
 */
export async function createTestDb(): Promise<TestDb> {
  const url = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const schemaName = `test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const admin = new Pool({ connectionString: url });
  try {
    await admin.query(`CREATE SCHEMA "${schemaName}"`);
  } finally {
    await admin.end();
  }

  const pool = new Pool({
    connectionString: url,
    max: 30,
    options: `-c search_path=${schemaName},public`,
  });
  const db = drizzle(pool, { schema });

  for (const stmt of readMigrationStatements()) {
    await pool.query(stmt);
  }

  async function cleanup(): Promise<void> {
    await pool.end();
    const dropper = new Pool({ connectionString: url });
    try {
      await dropper.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    } finally {
      await dropper.end();
    }
  }

  return { db, pool, schemaName, cleanup };
}

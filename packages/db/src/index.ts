/**
 * packages/db — Drizzle schema, migrations, and the economy mutation helpers.
 *
 * Per CLAUDE.md, ALL economy mutations flow through helpers in this package that
 * write an append-only `ledger` row in the SAME transaction as the mutation —
 * never from the client. `moveShards` is the only exported function that writes
 * `characters.shards`.
 */
export * from "./schema";
export * from "./errors";
export * from "./client";
export * from "./helpers";

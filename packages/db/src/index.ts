/**
 * packages/db — Drizzle schema, migrations, and the economy mutation helpers.
 *
 * Per CLAUDE.md, ALL economy mutations (Shards, items, tiles, quest state) flow
 * through helpers in this package that write an append-only `ledger` row in the
 * SAME transaction as the mutation — never from the client. The schema and the
 * `moveShards` / `moveItems` helpers land in P1 (docs/crypto-valley-mvp.md §2).
 */

/** Placeholder export so the package + test pipeline is wired up. */
export const DB_PACKAGE = "@crypto-valley/db" as const;

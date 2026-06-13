import { ITEMS } from "@crypto-valley/content";

import { createDb, createPool } from "./client";
import { itemDefs } from "./schema";

/**
 * Idempotently upserts the static item catalog into `item_defs`.
 * Running it repeatedly leaves the row count unchanged.
 */
async function main(): Promise<void> {
  const pool = createPool();
  const db = createDb(pool);
  try {
    for (const item of ITEMS) {
      const row = {
        id: item.id,
        category: item.category,
        stackMax: item.stackMax,
        baseValue: item.baseValue,
        tradeable: item.tradeable,
        mintable: item.mintable,
        meta: item.meta,
      };
      await db
        .insert(itemDefs)
        .values(row)
        .onConflictDoUpdate({
          target: itemDefs.id,
          set: {
            category: row.category,
            stackMax: row.stackMax,
            baseValue: row.baseValue,
            tradeable: row.tradeable,
            mintable: row.mintable,
            meta: row.meta,
          },
        });
    }
    console.log(`seeded ${ITEMS.length} item definitions`);
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

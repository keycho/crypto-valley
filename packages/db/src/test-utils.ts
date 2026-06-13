import { uuidv7 } from "uuidv7";

import type { Database } from "./client";
import { accounts, characters, inventorySlots, itemDefs } from "./schema";

/** Inserts an account + character (UUIDv7 ids) and returns the character id. */
export async function seedCharacter(db: Database, shards = 500): Promise<string> {
  const accountId = uuidv7();
  await db.insert(accounts).values({ id: accountId });
  const id = uuidv7();
  await db.insert(characters).values({
    id,
    accountId,
    name: `c${id.replace(/-/g, "").slice(0, 12)}`,
    appearance: {},
    shards,
  });
  return id;
}

export async function seedItemDef(
  db: Database,
  id: string,
  stackMax = 999,
  category = "resource",
): Promise<void> {
  await db
    .insert(itemDefs)
    .values({ id, category, stackMax, baseValue: 1 })
    .onConflictDoNothing();
}

export async function seedSlot(
  db: Database,
  characterId: string,
  slot: number,
  itemId: string,
  qty: number,
  container = "backpack",
): Promise<void> {
  await db.insert(inventorySlots).values({ characterId, container, slot, itemId, qty });
}

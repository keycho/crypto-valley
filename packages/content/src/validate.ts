import { argv } from "node:process";
import { pathToFileURL } from "node:url";

import { ITEMS, type ItemDef } from "./items";
import { QUEST_BY_ID, QUESTS, type QuestDef } from "./quests";

/** Meta keys whose string values must reference another item id in the catalog. */
const META_ITEM_REFS = ["crop", "seed", "smeltedFrom"] as const;

/** Returns a list of human-readable problems; empty means the catalog is valid. */
export function validateCatalog(items: readonly ItemDef[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const item of items) {
    if (ids.has(item.id)) errors.push(`duplicate item id: ${item.id}`);
    ids.add(item.id);
  }

  for (const item of items) {
    for (const key of META_ITEM_REFS) {
      const ref = item.meta[key];
      if (typeof ref === "string" && !ids.has(ref)) {
        errors.push(`item ${item.id}: meta.${key} references unknown item "${ref}"`);
      }
    }
  }

  return errors;
}

/** Every quest reward/objective item must be a real item; unlocks must resolve. */
export function validateQuests(quests: readonly QuestDef[], items: readonly ItemDef[]): string[] {
  const errors: string[] = [];
  const itemIds = new Set(items.map((i) => i.id));
  const ids = new Set<string>();

  for (const q of quests) {
    if (ids.has(q.id)) errors.push(`duplicate quest id: ${q.id}`);
    ids.add(q.id);
    if (q.objectives.length === 0) errors.push(`quest ${q.id}: no objectives`);
    for (const o of q.objectives) {
      if (o.target <= 0) errors.push(`quest ${q.id}: objective target must be > 0`);
      if ((o.type === "gather") && !o.item) errors.push(`quest ${q.id}: gather objective needs an item`);
      if (o.item && !itemIds.has(o.item)) {
        errors.push(`quest ${q.id}: objective references unknown item "${o.item}"`);
      }
    }
    if (q.reward.shards < 0) errors.push(`quest ${q.id}: negative shard reward`);
    for (const r of q.reward.items ?? []) {
      if (!itemIds.has(r.item)) errors.push(`quest ${q.id}: reward references unknown item "${r.item}"`);
      if (r.qty <= 0) errors.push(`quest ${q.id}: reward qty must be > 0`);
    }
    if (q.unlocks && !QUEST_BY_ID[q.unlocks]) {
      errors.push(`quest ${q.id}: unlocks unknown quest "${q.unlocks}"`);
    }
  }
  return errors;
}

// CI-runnable entry point: `tsx src/validate.ts`.
const isMain = import.meta.url === pathToFileURL(argv[1] ?? "").href;
if (isMain) {
  const errors = [...validateCatalog(ITEMS), ...validateQuests(QUESTS, ITEMS)];
  if (errors.length > 0) {
    console.error("content is invalid:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`content OK (${ITEMS.length} items, ${QUESTS.length} quests)`);
}

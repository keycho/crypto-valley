import { argv } from "node:process";
import { pathToFileURL } from "node:url";

import { ITEMS, type ItemDef } from "./items";

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

// CI-runnable entry point: `tsx src/validate.ts`.
const isMain = import.meta.url === pathToFileURL(argv[1] ?? "").href;
if (isMain) {
  const errors = validateCatalog(ITEMS);
  if (errors.length > 0) {
    console.error("content catalog is invalid:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`content catalog OK (${ITEMS.length} items)`);
}

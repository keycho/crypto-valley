import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type ItemCategory =
  | "resource"
  | "seed"
  | "crop"
  | "tool"
  | "machine"
  | "decoration"
  | "relic"
  | "consumable";

/** Mirrors the `item_defs` columns in packages/db. */
export interface ItemDef {
  id: string;
  category: ItemCategory;
  stackMax: number;
  baseValue: number;
  tradeable: boolean;
  mintable: boolean;
  meta: Record<string, unknown>;
}

const itemsPath = fileURLToPath(new URL("../items.json", import.meta.url));

/** The static starter item catalog. */
export const ITEMS: readonly ItemDef[] = JSON.parse(
  readFileSync(itemsPath, "utf8"),
) as ItemDef[];

// JSON import (not node:fs) so the content package stays browser-safe — the web
// client imports this package for plot/tier data (P6).
import itemsJson from "../items.json";

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

/** The static starter item catalog. */
export const ITEMS: readonly ItemDef[] = itemsJson as unknown as readonly ItemDef[];

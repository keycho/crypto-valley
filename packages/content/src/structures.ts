/**
 * Placeable structures — GAME DATA AS CODE (P7).
 *
 * A claimed plot is a CANVAS: the owner freely places structures on it and grows
 * them vertically up an upgrade chain (hut → cabin → house → tower → high-rise →
 * skyscraper) — a player-built skyline advancing through the ages. Plus a few
 * standalone build pieces (wall, gate, lamp).
 *
 * All costs are wood/stone (gathered on the island) + Shards, consumed
 * server-side via the dupe-proof `moveItems`/`moveShards` helpers. Footprints are
 * in tiles. Footprints are CONSTANT across a chain (only the sprite grows taller)
 * so an in-place upgrade never needs to re-validate bounds/overlap.
 */

export type StructureFamily = "building" | "standalone";

export interface StructureCost {
  wood: number;
  stone: number;
  shards: number;
}

export interface StructureDef {
  id: string;
  name: string;
  family: StructureFamily;
  /** Footprint in tiles (constant within an upgrade chain). */
  footprint: { w: number; h: number };
  /** Vertical tier (1 = base). Stored on the structure row as `level`. */
  tier: number;
  /** Cost to OBTAIN this def: to place it (a base) or to upgrade INTO it. */
  cost: StructureCost;
  /** Next def id in the chain, or null if this is the top / standalone. */
  nextTier: string | null;
  /** Frame index in `structures.png`. */
  frame: number;
  /** True = appears in the build palette (placeable directly). */
  placeable: boolean;
}

/**
 * The catalog. Frame indices are the column order in `structures.png`. The
 * building chain shares a 2×2 footprint and grows only in height; standalones
 * are one-offs (no nextTier). Costs escalate so a skyscraper is a real project —
 * you EARN the skyline, you can't just buy it.
 */
export const STRUCTURE_DEFS: readonly StructureDef[] = [
  // ---- vertical building chain (2×2; only `hut` is placeable, rest upgrade-in) -
  { id: "hut", name: "Hut", family: "building", footprint: { w: 2, h: 2 }, tier: 1, cost: { wood: 8, stone: 0, shards: 15 }, nextTier: "cabin", frame: 0, placeable: true },
  { id: "cabin", name: "Cabin", family: "building", footprint: { w: 2, h: 2 }, tier: 2, cost: { wood: 18, stone: 6, shards: 30 }, nextTier: "house", frame: 1, placeable: false },
  { id: "house", name: "House", family: "building", footprint: { w: 2, h: 2 }, tier: 3, cost: { wood: 35, stone: 18, shards: 60 }, nextTier: "tower", frame: 2, placeable: false },
  { id: "tower", name: "Tower", family: "building", footprint: { w: 2, h: 2 }, tier: 4, cost: { wood: 60, stone: 40, shards: 120 }, nextTier: "high_rise", frame: 3, placeable: false },
  { id: "high_rise", name: "High-Rise", family: "building", footprint: { w: 2, h: 2 }, tier: 5, cost: { wood: 100, stone: 80, shards: 220 }, nextTier: "skyscraper", frame: 4, placeable: false },
  { id: "skyscraper", name: "Skyscraper", family: "building", footprint: { w: 2, h: 2 }, tier: 6, cost: { wood: 160, stone: 140, shards: 400 }, nextTier: null, frame: 5, placeable: false },
  // ---- standalone props (placeable directly, no chain) -----------------------
  { id: "wall", name: "Wall", family: "standalone", footprint: { w: 1, h: 1 }, tier: 1, cost: { wood: 4, stone: 2, shards: 2 }, nextTier: null, frame: 6, placeable: true },
  { id: "gate", name: "Gate", family: "standalone", footprint: { w: 1, h: 1 }, tier: 1, cost: { wood: 8, stone: 4, shards: 8 }, nextTier: null, frame: 7, placeable: true },
  { id: "lamp", name: "Lamp", family: "standalone", footprint: { w: 1, h: 1 }, tier: 1, cost: { wood: 2, stone: 1, shards: 10 }, nextTier: null, frame: 8, placeable: true },
] as const;

export const STRUCTURE_BY_ID: Record<string, StructureDef> = Object.fromEntries(
  STRUCTURE_DEFS.map((d) => [d.id, d]),
);

/** Palette items, in display order (the building base first). */
export const PLACEABLE_STRUCTURES: readonly StructureDef[] = STRUCTURE_DEFS.filter(
  (d) => d.placeable,
);

/** The def a structure upgrades INTO, or null if maxed / standalone. */
export function nextStructure(defId: string): StructureDef | null {
  const cur = STRUCTURE_BY_ID[defId];
  if (!cur || !cur.nextTier) return null;
  return STRUCTURE_BY_ID[cur.nextTier] ?? null;
}

/** Fraction of a structure's cost refunded when the owner removes it. */
export const REFUND_FRACTION = 0.5;

/** Materials/Shards returned when removing a structure of this def. */
export function structureRefund(def: StructureDef): StructureCost {
  return {
    wood: Math.floor(def.cost.wood * REFUND_FRACTION),
    stone: Math.floor(def.cost.stone * REFUND_FRACTION),
    shards: Math.floor(def.cost.shards * REFUND_FRACTION),
  };
}

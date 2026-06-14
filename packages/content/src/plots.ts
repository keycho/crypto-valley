/**
 * Land plots + gathering — GAME DATA AS CODE (P6).
 *
 * The island is divided into a fixed grid of claimable 6×6 PLOTS arranged in a
 * ring around the central plaza. Positions are hand-locked (chosen by a
 * deterministic fit-scan against the island geometry in gen-town-map) so the map
 * generator, the API zone rules, and the client all agree and cannot drift —
 * same pattern as `FARM`.
 *
 * Tiers are an upgrade ladder (empty → mansion); each step costs materials
 * (wood/stone gathered on the island) + Shards, consumed server-side through the
 * dupe-proof `moveItems`/`moveShards` helpers. There is NO token/NFT/deed here —
 * currency is Shards, off-chain.
 */

/** Plot footprint, in tiles. */
export const PLOT_W = 6;
export const PLOT_H = 6;

export interface PlotDef {
  /** Stable index — the primary key the server claims/upgrades against. */
  index: number;
  /** Top-left tile of the 6×6 footprint. */
  x: number;
  y: number;
}

/**
 * The 12 claimable plots, ringing the plaza. Locked tile origins; every plot
 * sits on (mostly) solid island land — the map generator lays a foundation pad
 * under each so none float over the void.
 */
export const PLOTS: readonly PlotDef[] = [
  { index: 0, x: 21, y: 7 },
  { index: 1, x: 33, y: 7 },
  { index: 2, x: 40, y: 11 },
  { index: 3, x: 14, y: 14 },
  { index: 4, x: 9, y: 26 },
  { index: 5, x: 16, y: 26 },
  { index: 6, x: 38, y: 26 },
  { index: 7, x: 45, y: 26 },
  { index: 8, x: 23, y: 30 },
  { index: 9, x: 15, y: 33 },
  { index: 10, x: 33, y: 33 },
  { index: 11, x: 40, y: 33 },
] as const;

/** Shards charged to claim an unclaimed plot (small, off a 500 starting purse). */
export const CLAIM_COST_SHARDS = 40;

/** Highest buildable tier (0 = empty lot, 5 = mansion). */
export const MAX_TIER = 5;

export interface TierDef {
  tier: number;
  /** Display name + the sprite frame index in `plots.png`. */
  name: string;
  /** Cost to reach THIS tier from the previous one (tier 0 is free on claim). */
  wood: number;
  stone: number;
  shards: number;
}

/**
 * The build ladder. `PLOT_TIERS[t]` is the state at tier `t`; its wood/stone/
 * shards are what an upgrade *into* tier `t` costs. Escalating so a shack is
 * quick and a mansion is a real project.
 */
export const PLOT_TIERS: readonly TierDef[] = [
  { tier: 0, name: "Empty Lot", wood: 0, stone: 0, shards: 0 },
  { tier: 1, name: "Shack", wood: 8, stone: 0, shards: 20 },
  { tier: 2, name: "Cottage", wood: 20, stone: 8, shards: 50 },
  { tier: 3, name: "House", wood: 40, stone: 25, shards: 110 },
  { tier: 4, name: "Manor", wood: 75, stone: 55, shards: 220 },
  { tier: 5, name: "Mansion", wood: 130, stone: 110, shards: 420 },
] as const;

/** Cost to upgrade from `tier` to `tier+1`, or null if already maxed. */
export function upgradeCost(tier: number): TierDef | null {
  const next = tier + 1;
  return next <= MAX_TIER ? PLOT_TIERS[next] : null;
}

/** Returns the plot whose footprint contains tile (tx,ty), or null. */
export function plotAt(tx: number, ty: number): PlotDef | null {
  for (const p of PLOTS) {
    if (tx >= p.x && tx < p.x + PLOT_W && ty >= p.y && ty < p.y + PLOT_H) return p;
  }
  return null;
}

/** Bottom-center tile of a plot — where a building/nameplate anchors. */
export function plotAnchor(p: PlotDef): { x: number; y: number } {
  return { x: p.x + PLOT_W / 2, y: p.y + PLOT_H };
}

// ============================================================ gathering nodes
export type GatherKind = "tree" | "rock";

export interface GatherNodeDef {
  /** Stable id (matches a row in `world_nodes` once first harvested). */
  id: string;
  kind: GatherKind;
  /** Anchor tile (the sprite's bottom-center foot). */
  x: number;
  y: number;
}

/** What each node yields, what it costs, and which skill it trains. */
export const GATHER: Record<GatherKind, { item: string; qty: number; energy: number; skill: string }> = {
  tree: { item: "wood", qty: 3, energy: 3, skill: "foraging" },
  rock: { item: "stone", qty: 3, energy: 3, skill: "mining" },
};

/**
 * Choppable trees + mineable rocks scattered through the overgrowth between the
 * plots. Locked positions (deterministic fit-scan), reachable from open land.
 */
export const GATHER_NODES: readonly GatherNodeDef[] = [
  { id: "tree_0", kind: "tree", x: 28, y: 9 },
  { id: "rock_1", kind: "rock", x: 28, y: 13 },
  { id: "tree_2", kind: "tree", x: 21, y: 14 },
  { id: "rock_3", kind: "rock", x: 33, y: 14 },
  { id: "tree_4", kind: "tree", x: 37, y: 14 },
  { id: "rock_5", kind: "rock", x: 47, y: 14 },
  { id: "tree_6", kind: "tree", x: 41, y: 18 },
  { id: "rock_7", kind: "rock", x: 45, y: 18 },
  { id: "tree_8", kind: "tree", x: 49, y: 18 },
  { id: "rock_9", kind: "rock", x: 11, y: 21 },
  { id: "tree_10", kind: "tree", x: 15, y: 21 },
  { id: "rock_11", kind: "rock", x: 22, y: 37 },
  { id: "tree_12", kind: "tree", x: 26, y: 37 },
] as const;

export const GATHER_NODE_BY_ID: Record<string, GatherNodeDef> = Object.fromEntries(
  GATHER_NODES.map((n) => [n.id, n]),
);

/** One in-game day (1440 game-minutes at the normal 1-min/s clock), in real ms. */
export const GATHER_RESPAWN_GAME_MS = 24 * 60 * 60 * 1000;

/**
 * PURE: a node is harvestable when it has never been harvested, or its last
 * harvest is older than the respawn window. Time is a parameter (testable).
 */
export function nodeAvailable(
  harvestedAt: number | null,
  now: number,
  respawnMs: number,
): boolean {
  return harvestedAt === null || now - harvestedAt >= respawnMs;
}

import { create } from "zustand";

import type { GatherKind, WorldState } from "@crypto-valley/shared";

/** A gather node the player is standing next to (drives the Space prompt). */
export interface NearNode {
  id: string;
  kind: GatherKind;
}

/**
 * Town/plot state mirror (P6). Phaser's TownController writes the latest
 * /world/state here + which plot the player stands on / node they're near; the
 * React HUD (PlotPanel) reads it. All authority stays server-side.
 */
interface WorldStore {
  world: WorldState | null;
  /** Plot index the player is currently standing on, or null. */
  standingPlot: number | null;
  /** Adjacent harvestable node, or null. */
  nearNode: NearNode | null;
  patch: (p: Partial<Pick<WorldStore, "world" | "standingPlot" | "nearNode">>) => void;
}

export const useWorldStore = create<WorldStore>((set) => ({
  world: null,
  standingPlot: null,
  nearNode: null,
  patch: (p) => set(p),
}));

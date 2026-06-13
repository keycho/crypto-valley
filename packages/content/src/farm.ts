/**
 * Starter-farm layout — shared by the web map generator and the API zone rules
 * so they cannot drift. Tile coordinates.
 */
export const FARM = {
  width: 40,
  height: 30,
  /** Tillable soil rectangle (inclusive). Hoe/plant are rejected outside it. */
  plot: { x0: 6, y0: 7, x1: 22, y1: 17 },
  /** Where the player appears when entering the farm. */
  spawn: { x: 20, y: 22 },
  /** Stepping here warps back to town. */
  warpToTown: { x: 20, y: 27 },
} as const;

/** Stepping here in town warps to the farm (north end of the island's main street). */
export const TOWN_WARP_TO_FARM = { x: 30, y: 11 } as const;

export function inFarmPlot(x: number, y: number): boolean {
  return (
    x >= FARM.plot.x0 && x <= FARM.plot.x1 && y >= FARM.plot.y0 && y <= FARM.plot.y1
  );
}

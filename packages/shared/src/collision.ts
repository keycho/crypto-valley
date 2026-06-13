/**
 * Tiled (.tmj) collision loader, shared by client and server so movement
 * validation uses the IDENTICAL grid. The "collision" tile layer holds non-zero
 * marker tiles on solid cells.
 */
export interface TmjLayer {
  name: string;
  data?: number[];
}
export interface TmjMap {
  width: number;
  height: number;
  tilewidth: number;
  layers: TmjLayer[];
}

export interface CollisionGrid {
  width: number;
  height: number;
  tile: number;
  solidTile(tx: number, ty: number): boolean;
  solidAtPx(x: number, y: number): boolean;
}

export function parseCollision(map: TmjMap): CollisionGrid {
  const { width, height, tilewidth } = map;
  const layer = map.layers.find((l) => l.name === "collision");
  const data = layer?.data ?? [];
  const grid = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) grid[i] = data[i] !== 0 ? 1 : 0;

  const solidTile = (tx: number, ty: number): boolean =>
    tx < 0 || ty < 0 || tx >= width || ty >= height || grid[ty * width + tx] === 1;

  return {
    width,
    height,
    tile: tilewidth,
    solidTile,
    solidAtPx: (x, y) => solidTile(Math.floor(x / tilewidth), Math.floor(y / tilewidth)),
  };
}

/**
 * Cheap-authoritative move check (art doc §3.1: validate, don't re-simulate):
 * the step must be within the speed budget and not land feet-first in a wall.
 * `feetDy` lifts the test point to the sprite's feet.
 */
export function isMoveLegal(
  grid: CollisionGrid,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  maxDist: number,
  feetDy = 12,
): boolean {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (dx * dx + dy * dy > maxDist * maxDist) return false; // speed cap
  if (grid.solidAtPx(toX, toY + feetDy)) return false; // into a wall
  return true;
}

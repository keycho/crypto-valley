/**
 * Generates apps/web/public/assets/maps/farm.tmj — the starter farm: a soil plot
 * (FARM.plot, shared with the API zone rules), the player's house exterior, a
 * few trees, grass, and a warp back to town. Six standard layers; deterministic.
 *
 * Soil-state changes (tilled/watered) and crops are NOT baked here — they live
 * in packages/db and are rendered at runtime by the farm controller. This map is
 * the static base only.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { FARM } from "@crypto-valley/content";

const here = dirname(fileURLToPath(import.meta.url));
const TILESET_DIR = join(here, "../public/assets/tilesets");
const OUT_DIR = join(here, "../public/assets/maps");

interface Manifest {
  tileSize: number;
  columns: number;
  rows: number;
  tiles: Record<string, number>;
  objects: Record<string, { col: number; row: number; w: number; h: number }>;
}
const manifest: Manifest = JSON.parse(
  readFileSync(join(TILESET_DIR, "town_tiles.manifest.json"), "utf8"),
);

const W = FARM.width;
const H = FARM.height;
const TILE = manifest.tileSize;
const FIRSTGID = 1;

const gid = (n: string): number => {
  const i = manifest.tiles[n];
  if (i === undefined) throw new Error(`unknown tile: ${n}`);
  return i + FIRSTGID;
};
const objGid = (n: string, dx: number, dy: number): number => {
  const o = manifest.objects[n];
  if (!o) throw new Error(`unknown object: ${n}`);
  return (o.row + dy) * manifest.columns + (o.col + dx) + FIRSTGID;
};
const objSize = (n: string) => {
  const o = manifest.objects[n];
  if (!o) throw new Error(`unknown object: ${n}`);
  return { w: o.w, h: o.h };
};

let s = 0x5eed5;
const rng = (): number => ((s = (s * 1664525 + 1013904223) >>> 0), s / 0x100000000);

const ground = new Array<number>(W * H).fill(0);
const groundDetail = new Array<number>(W * H).fill(0);
const collision = new Array<number>(W * H).fill(0);
const above = new Array<number>(W * H).fill(0);
const at = (x: number, y: number): number => y * W + x;
const inB = (x: number, y: number): boolean => x >= 0 && x < W && y >= 0 && y < H;
const MARK = gid("collision_marker");

interface Marker {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  kind?: string;
  to?: string;
  w?: number;
  h?: number;
}
const markers: Marker[] = [];
const lights: Marker[] = [];
let mid = 1;
const px = (t: number): number => t * TILE;
function shadow(tx: number, ty: number, wTiles: number, hPx: number, label: string): void {
  markers.push({ id: mid++, name: `shadow_${label}`, type: "shadow", x: px(tx) + (wTiles * TILE) / 2, y: px(ty) + 3, w: Math.round(wTiles * TILE * 0.96), h: hPx });
}

// ground: grass, with the tillable soil plot
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    ground[at(x, y)] = rng() < 0.12 ? gid("grass_b") : gid("grass");
  }
}
for (let y = FARM.plot.y0; y <= FARM.plot.y1; y++) {
  for (let x = FARM.plot.x0; x <= FARM.plot.x1; x++) ground[at(x, y)] = gid("soil");
}
// a short path from the plot down to the warp
for (let y = FARM.plot.y1 + 1; y <= FARM.warpToTown.y; y++) {
  ground[at(FARM.spawn.x, y)] = gid("road");
  ground[at(FARM.spawn.x + 1, y)] = gid("road");
}

// objects: house + trees (bottom rows collide, top rows on "above")
function stamp(name: string, tx: number, ty: number, solidRows: number, shadowH: number): void {
  const { w, h } = objSize(name);
  const splitY = h - solidRows;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (!inB(x, y)) throw new Error(`${name} OOB ${x},${y}`);
      const g = objGid(name, dx, dy);
      if (dy >= splitY) {
        groundDetail[at(x, y)] = g;
        collision[at(x, y)] = MARK;
      } else above[at(x, y)] = g;
    }
  }
  shadow(tx, ty + h, w, shadowH, `${name}_${tx}_${ty}`);
}

stamp("container_house", 16, 1, 3, 12);
lights.push({ id: mid++, name: "house_window", type: "light", x: px(18), y: px(4), kind: "window" });
for (const [t, x, y] of [
  ["tree_b", 2, 18],
  ["tree_a", 31, 8],
  ["tree_b", 34, 19],
  ["tree_a", 7, 23],
] as Array<[string, number, number]>) {
  stamp(t, x, y, 1, 10);
}

// sparse life on the grass (not on soil)
const DECOR = ["weed_a", "weed_b", "flower_a", "flower_b", "shrub_a"];
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    if (ground[at(x, y)] !== gid("grass") && ground[at(x, y)] !== gid("grass_b")) continue;
    if (groundDetail[at(x, y)] !== 0 || collision[at(x, y)] !== 0) continue;
    if (rng() < 0.06) groundDetail[at(x, y)] = gid(DECOR[Math.floor(rng() * DECOR.length)]!);
  }
}

// markers: spawn + warp back to town
markers.push({ id: mid++, name: "spawn", type: "spawn", x: px(FARM.spawn.x), y: px(FARM.spawn.y) });
markers.push({ id: mid++, name: "to_town", type: "warp", to: "town", x: px(FARM.warpToTown.x), y: px(FARM.warpToTown.y) });

// border collision ring
for (let x = 0; x < W; x++) {
  collision[at(x, 0)] = MARK;
  collision[at(x, H - 1)] = MARK;
}
for (let y = 0; y < H; y++) {
  collision[at(0, y)] = MARK;
  collision[at(W - 1, y)] = MARK;
}

let layerId = 1;
const tileLayer = (name: string, data: number[], visible = true) => ({
  id: layerId++, name, type: "tilelayer" as const, width: W, height: H, x: 0, y: 0, opacity: 1, visible, data,
});
const objLayer = (name: string, objs: Marker[]) => ({
  id: layerId++, name, type: "objectgroup" as const, x: 0, y: 0, opacity: 1, visible: true, draworder: "topdown" as const,
  objects: objs.map((o) => ({
    id: o.id, name: o.name, type: o.type, x: o.x, y: o.y,
    ...(o.w !== undefined && o.h !== undefined ? { width: o.w, height: o.h } : { point: true }),
    visible: true, rotation: 0,
    properties: [
      ...(o.kind ? [{ name: "kind", type: "string", value: o.kind }] : []),
      ...(o.to ? [{ name: "to", type: "string", value: o.to }] : []),
    ],
  })),
});

const map = {
  type: "map", version: "1.10", tiledversion: "1.10.2", orientation: "orthogonal",
  renderorder: "right-down", infinite: false, width: W, height: H, tilewidth: TILE, tileheight: TILE,
  compressionlevel: -1, nextlayerid: 99, nextobjectid: 999,
  layers: [
    tileLayer("ground", ground),
    tileLayer("ground_detail", groundDetail),
    tileLayer("collision", collision, false),
    objLayer("objects", markers),
    tileLayer("above", above),
    objLayer("lights", lights),
  ],
  tilesets: [
    {
      firstgid: FIRSTGID, name: "town_tiles", image: "../tilesets/town_tiles.png",
      imagewidth: manifest.columns * TILE, imageheight: manifest.rows * TILE,
      tilewidth: TILE, tileheight: TILE, tilecount: manifest.columns * manifest.rows,
      columns: manifest.columns, margin: 0, spacing: 0,
    },
  ],
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "farm.tmj"), JSON.stringify(map));
console.log(`wrote farm.tmj (${W}x${H}); ${markers.length} markers, ${lights.length} lights`);

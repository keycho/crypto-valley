/**
 * Generates apps/web/public/assets/maps/town.tmj — the town as a BOUNDED FLOATING
 * ISLAND: a fragment of a fallen city (broken streets + plaza + overgrowth) whose
 * organic edges crumble into the void. Tiles outside the landmass are EMPTY so the
 * dark starfield (drawn by WorldScene) shows through.
 *
 * 60x50 @16px grid, six standard layers. A central paved plaza (with the dead
 * terminal) and two streets radiate out to the crumbling rim; buildings ring the
 * plaza; overgrowth thickens toward the edges. Collision walls the island edge so
 * players can't walk into the void.
 *
 * Deterministic: a fixed-seed LCG + hashed value-noise, so re-running reproduces a
 * byte-identical file. Run via `pnpm --filter @crypto-valley/web gen:map`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TOWN_WARP_TO_FARM } from "@crypto-valley/content";

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

const W = 60;
const H = 50;
const TILE = manifest.tileSize;
const FIRSTGID = 1;

const gid = (name: string): number => {
  const idx = manifest.tiles[name];
  if (idx === undefined) throw new Error(`unknown tile: ${name}`);
  return idx + FIRSTGID;
};
const objGid = (name: string, dx: number, dy: number): number => {
  const o = manifest.objects[name];
  if (!o) throw new Error(`unknown object: ${name}`);
  return (o.row + dy) * manifest.columns + (o.col + dx) + FIRSTGID;
};
const objSize = (name: string): { w: number; h: number } => {
  const o = manifest.objects[name];
  if (!o) throw new Error(`unknown object: ${name}`);
  return { w: o.w, h: o.h };
};

let rngState = 0x0bada55;
const rng = (): number => {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 0x100000000;
};
const chance = (p: number): boolean => rng() < p;
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

// Hashed value noise (independent of the rng() stream so edits don't reshuffle).
const hash2 = (ix: number, iy: number): number => {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
};
const smooth = (t: number): number => t * t * (3 - 2 * t);
function valueNoise(x: number, y: number, cell: number, salt: number): number {
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = smooth(gx - x0);
  const fy = smooth(gy - y0);
  const n = (a: number, b: number): number => hash2(a + salt, b - salt);
  const n00 = n(x0, y0);
  const n10 = n(x0 + 1, y0);
  const n01 = n(x0, y0 + 1);
  const n11 = n(x0 + 1, y0 + 1);
  return (n00 + (n10 - n00) * fx) * (1 - fy) + (n01 + (n11 - n01) * fx) * fy;
}

const EMPTY = 0;
const ground = new Array<number>(W * H).fill(EMPTY);
const groundDetail = new Array<number>(W * H).fill(EMPTY);
const collision = new Array<number>(W * H).fill(EMPTY);
const above = new Array<number>(W * H).fill(EMPTY);
const land = new Array<boolean>(W * H).fill(false);
const at = (x: number, y: number): number => y * W + x;
const inBounds = (x: number, y: number): boolean => x >= 0 && x < W && y >= 0 && y < H;
const MARK = gid("collision_marker");

// ============================================================ island mask
const CX = 30;
const CY = 24;
const RX = 26;
const RY = 20.5;
const radial = (x: number, y: number): number => Math.hypot((x - CX) / RX, (y - CY) / RY);
function isLandRaw(x: number, y: number): boolean {
  const r = radial(x, y);
  const edge = 0.84 + (valueNoise(x, y, 7, 101) - 0.5) * 0.42; // wavy ~0.63..1.05
  if (r >= edge) return false;
  if (r > edge - 0.14 && hash2(x * 5 + 9, y * 5 + 1) < 0.3) return false; // crumble
  return true;
}
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) land[at(x, y)] = isLandRaw(x, y);
}

// ============================================================ regions / streets
const PLAZA = { x0: 24, y0: 18, x1: 37, y1: 29 };
const ROAD_VX = 30; // vertical street cols 30-31
const ROAD_HY = 23; // horizontal street rows 23-24
const inPlaza = (x: number, y: number): boolean =>
  x >= PLAZA.x0 && x <= PLAZA.x1 && y >= PLAZA.y0 && y <= PLAZA.y1;
const onRoad = (x: number, y: number): boolean =>
  land[at(x, y)] && (x === ROAD_VX || x === ROAD_VX + 1 || y === ROAD_HY || y === ROAD_HY + 1);
/** Central paved disc — the urban core; grass/overgrowth reclaims the rim. */
const inPavedCore = (x: number, y: number): boolean => radial(x, y) < 0.52;

// ground: grass on land (void stays empty), then carve the paved core
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!land[at(x, y)]) continue;
    if (inPavedCore(x, y) || inPlaza(x, y)) ground[at(x, y)] = gid("concrete");
    else ground[at(x, y)] = chance(0.16) ? gid("grass_b") : gid("grass");
  }
}
// streets radiate to the rim (clipped to land)
for (let y = 0; y < H; y++) {
  for (const x of [ROAD_VX, ROAD_VX + 1]) {
    if (!land[at(x, y)]) continue;
    ground[at(x, y)] = x === ROAD_VX && y % 3 === 0 ? gid("road_line") : gid("road");
  }
}
for (let x = 0; x < W; x++) {
  for (const y of [ROAD_HY, ROAD_HY + 1]) {
    if (!land[at(x, y)]) continue;
    ground[at(x, y)] = y === ROAD_HY && x % 3 === 0 ? gid("road_line") : gid("road");
  }
}
// worn pavement, clustered (calm large areas; abandoned via overlays)
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (ground[at(x, y)] !== gid("concrete") || onRoad(x, y)) continue;
    if (valueNoise(x, y, 6, 7) > 0.66 && hash2(x * 7 + 1, y * 7 + 3) < 0.55) {
      ground[at(x, y)] = hash2(x + 13, y + 29) < 0.5 ? gid("concrete_b") : gid("concrete_c");
    }
  }
}

// ============================================================ object machinery
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
let markerId = 1;
const px = (t: number): number => t * TILE;

function emitShadow(tx: number, ty: number, wTiles: number, hPx: number, label: string): void {
  markers.push({
    id: markerId++,
    name: `shadow_${label}`,
    type: "shadow",
    x: px(tx) + (wTiles * TILE) / 2,
    y: px(ty) + 3,
    w: Math.round(wTiles * TILE * 0.96),
    h: hPx,
  });
}
/** Footprints sit on solid ground (a foundation), never floating over void. */
function foundation(x: number, y: number, paved: boolean): void {
  land[at(x, y)] = true;
  if (ground[at(x, y)] === EMPTY) ground[at(x, y)] = gid(paved ? "concrete" : "grass");
}

function stampBuilding(name: string, tx: number, ty: number): void {
  const { w, h } = objSize(name);
  const aboveRows = Math.max(1, Math.min(h - 1, Math.round(h * 0.5)));
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (!inBounds(x, y)) throw new Error(`${name} OOB at ${x},${y}`);
      foundation(x, y, true);
      const g = objGid(name, dx, dy);
      if (dy < aboveRows) above[at(x, y)] = g;
      else groundDetail[at(x, y)] = g;
      collision[at(x, y)] = MARK;
    }
  }
  lights.push({
    id: markerId++,
    name: `win_${name}_${tx}`,
    type: "light",
    x: px(tx + w / 2),
    y: px(ty + h - 2),
    kind: "window",
  });
  emitShadow(tx, ty + h, w, 14, `${name}_${tx}_${ty}`);
}

function stampTree(name: string, tx: number, ty: number): void {
  const { w, h } = objSize(name);
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (!inBounds(x, y)) throw new Error(`${name} OOB at ${x},${y}`);
      foundation(x, y, false);
      const g = objGid(name, dx, dy);
      if (dy < h - 1) above[at(x, y)] = g;
      else {
        groundDetail[at(x, y)] = g;
        collision[at(x, y)] = MARK;
      }
    }
  }
  emitShadow(tx, ty + h, w, 10, `${name}_${tx}_${ty}`);
}

function stampProp(name: string, tx: number, ty: number, aboveTop?: boolean): void {
  const { w, h } = objSize(name);
  const topIsAbove = aboveTop ?? h >= 3;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (!inBounds(x, y)) continue;
      foundation(x, y, false);
      const g = objGid(name, dx, dy);
      if (topIsAbove && dy === 0 && h >= 2) above[at(x, y)] = g;
      else groundDetail[at(x, y)] = g;
      if (dy === h - 1) collision[at(x, y)] = MARK;
    }
  }
  emitShadow(tx, ty + h, w, 7, `${name}_${tx}_${ty}`);
}

// ---- composition: buildings ring the plaza (north + south streets) ----------
stampBuilding("market_med", 14, 9); // x14-20
stampBuilding("junk_shack", 32, 9); // x32-37
stampBuilding("market_small", 40, 10); // x40-44
stampBuilding("power_house", 22, 8); // x22-28 (NW of plaza)
stampBuilding("container_house", 16, 34); // south district
stampBuilding("junk_shack", 27, 35); // south district
stampBuilding("container_house", 40, 34); // south-east

// ---- trees: plaza frame + overgrowth thickening toward the rim --------------
const trees: Array<[string, number, number]> = [
  ["tree_a", 21, 16],
  ["tree_b", 39, 16],
  ["tree_a", 21, 30],
  ["tree_b", 39, 30],
  ["tree_b", 12, 22],
  ["tree_a", 48, 22],
  ["tree_a", 34, 42],
  ["tree_b", 24, 42],
  ["tree_b", 9, 28],
  ["tree_a", 50, 30],
];
for (const [k, x, y] of trees) if (land[at(x, y)] && land[at(x, y + 2)]) stampTree(k, x, y);

// ---- plaza hero: dead terminal (just off the crossing so streets stay clear) -
const TERM = { tx: 33, ty: 19 };
const termBaseX = px(TERM.tx + 1);
const termBaseY = px(TERM.ty + 3);
collision[at(TERM.tx, TERM.ty + 2)] = MARK;
collision[at(TERM.tx + 1, TERM.ty + 2)] = MARK;
markers.push({ id: markerId++, name: "terminal", type: "terminal", x: termBaseX, y: termBaseY, kind: "terminal" });
lights.push({ id: markerId++, name: "terminal_glow", type: "light", x: termBaseX, y: px(TERM.ty) + 12, kind: "terminal" });

stampProp("bench", 26, 18);
stampProp("bench", 33, 27);
stampProp("flower_bush", 27, 27);
stampProp("flower_bush", 35, 18);
stampProp("street_lamp", 25, 16);
stampProp("street_lamp", 37, 28);
lights.push({ id: markerId++, name: "lamp_nw", type: "light", x: px(25) + 8, y: px(16) + 8, kind: "lamp" });
lights.push({ id: markerId++, name: "lamp_se", type: "light", x: px(37) + 8, y: px(28) + 8, kind: "lamp" });

stampProp("antenna", 44, 14);
stampProp("electric_box", 26, 32);
stampProp("hydrant", 23, 25, true);
stampProp("hydrant", 40, 22, true);
const debris: Array<[string, number, number]> = [
  ["barrel", 28, 14],
  ["barrel", 36, 33],
  ["scrap", 18, 30],
  ["scrap", 43, 28],
  ["trash", 33, 16],
  ["trash", 24, 33],
  ["trash", 42, 31],
];
for (const [k, x, y] of debris) if (land[at(x, y)]) stampProp(k, x, y);

// ============================================================ ground detail
const WEEDS = ["weed_a", "weed_b", "shrub_a", "shrub_b"];
const FLOWERS = ["flower_a", "flower_b", "flower_c"];
const CRACKS = ["crack_a", "crack_b"];
function scatterDetail(x: number, y: number): void {
  if (!land[at(x, y)] || groundDetail[at(x, y)] !== EMPTY || collision[at(x, y)] !== EMPTY) return;
  const isGrass = ground[at(x, y)] === gid("grass") || ground[at(x, y)] === gid("grass_b");
  const nearHot = inPlaza(x, y) || onRoad(x, y);
  const rimward = radial(x, y) > 0.62; // overgrowth thickens toward the rim
  const base = isGrass ? (rimward ? 0.26 : 0.16) : nearHot ? 0.22 : 0.14;
  if (!chance(base)) return;
  const roll = rng();
  if (isGrass) {
    groundDetail[at(x, y)] = gid(roll < 0.62 ? pick(WEEDS) : pick(FLOWERS));
  } else {
    groundDetail[at(x, y)] =
      roll < 0.2 ? gid(pick(CRACKS)) : roll < 0.72 ? gid(pick(WEEDS)) : gid(pick(FLOWERS));
  }
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) scatterDetail(x, y);

for (const [x, y] of [
  [ROAD_VX, 12],
  [ROAD_VX + 1, 34],
  [31, 25],
  [27, 24],
] as Array<[number, number]>) {
  if (land[at(x, y)] && collision[at(x, y)] === EMPTY && groundDetail[at(x, y)] === EMPTY) {
    groundDetail[at(x, y)] = gid(chance(0.5) ? "manhole" : "grate");
  }
}

// density guarantee: no bare 4x4 block of land
for (let by = 2; by + 3 < H; by += 4) {
  for (let bx = 2; bx + 3 < W; bx += 4) {
    let landCells = 0;
    let occupied = 0;
    for (let dy = 0; dy < 4; dy++) {
      for (let dx = 0; dx < 4; dx++) {
        if (!land[at(bx + dx, by + dy)]) continue;
        landCells++;
        if (groundDetail[at(bx + dx, by + dy)] !== EMPTY || collision[at(bx + dx, by + dy)] !== EMPTY) {
          occupied++;
        }
      }
    }
    if (landCells >= 8 && occupied === 0) {
      const cx = bx + 1 + Math.floor(rng() * 2);
      const cy = by + 1 + Math.floor(rng() * 2);
      if (!land[at(cx, cy)]) continue;
      const pavement = !(ground[at(cx, cy)] === gid("grass") || ground[at(cx, cy)] === gid("grass_b"));
      groundDetail[at(cx, cy)] = gid(pavement ? pick([...CRACKS, "weed_a"]) : pick(WEEDS));
    }
  }
}

// ============================================================ edge wall
// Void tiles touching land become invisible collision so players can't walk off.
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (land[at(x, y)]) continue;
    const touchesLand =
      (x > 0 && land[at(x - 1, y)]) ||
      (x < W - 1 && land[at(x + 1, y)]) ||
      (y > 0 && land[at(x, y - 1)]) ||
      (y < H - 1 && land[at(x, y + 1)]);
    if (touchesLand) collision[at(x, y)] = MARK;
  }
}

// ============================================================ markers + lights
markers.unshift({ id: markerId++, name: "spawn", type: "spawn", x: px(31), y: px(26) });
// 2-tile gate spanning both columns of the north street.
for (const wx of [TOWN_WARP_TO_FARM.x, TOWN_WARP_TO_FARM.x + 1]) {
  markers.push({
    id: markerId++,
    name: `to_farm_${wx}`,
    type: "warp",
    to: "farm",
    x: wx * TILE,
    y: TOWN_WARP_TO_FARM.y * TILE,
  });
}

// ============================================================ assemble
let layerId = 1;
const tileLayer = (name: string, data: number[], visible = true) => ({
  id: layerId++,
  name,
  type: "tilelayer" as const,
  width: W,
  height: H,
  x: 0,
  y: 0,
  opacity: 1,
  visible,
  data,
});
const objectLayer = (name: string, objs: Marker[]) => ({
  id: layerId++,
  name,
  type: "objectgroup" as const,
  x: 0,
  y: 0,
  opacity: 1,
  visible: true,
  draworder: "topdown" as const,
  objects: objs.map((o) => ({
    id: o.id,
    name: o.name,
    type: o.type,
    x: o.x,
    y: o.y,
    ...(o.w !== undefined && o.h !== undefined ? { width: o.w, height: o.h } : { point: true }),
    visible: true,
    rotation: 0,
    properties: [
      ...(o.kind ? [{ name: "kind", type: "string", value: o.kind }] : []),
      ...(o.to ? [{ name: "to", type: "string", value: o.to }] : []),
    ],
  })),
});

const map = {
  type: "map",
  version: "1.10",
  tiledversion: "1.10.2",
  orientation: "orthogonal",
  renderorder: "right-down",
  infinite: false,
  width: W,
  height: H,
  tilewidth: TILE,
  tileheight: TILE,
  compressionlevel: -1,
  nextlayerid: 99,
  nextobjectid: markerId + 1,
  layers: [
    tileLayer("ground", ground),
    tileLayer("ground_detail", groundDetail),
    tileLayer("collision", collision, false),
    objectLayer("objects", markers),
    tileLayer("above", above),
    objectLayer("lights", lights),
  ],
  tilesets: [
    {
      firstgid: FIRSTGID,
      name: "town_tiles",
      image: "../tilesets/town_tiles.png",
      imagewidth: manifest.columns * TILE,
      imageheight: manifest.rows * TILE,
      tilewidth: TILE,
      tileheight: TILE,
      tilecount: manifest.columns * manifest.rows,
      columns: manifest.columns,
      margin: 0,
      spacing: 0,
    },
  ],
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "town.tmj"), JSON.stringify(map));
const landCount = land.filter(Boolean).length;
console.log(`wrote town.tmj (${W}x${H}); island ${landCount} tiles, ${markers.length} markers, ${lights.length} lights`);

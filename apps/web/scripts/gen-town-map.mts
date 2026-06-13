/**
 * Generates apps/web/public/assets/maps/town.tmj — the "Overgrown Terminal" town:
 * a small post-collapse tech city being reclaimed by nature (art bible Law 2).
 *
 * 60x50 @16px, the six standard layers (ground / ground_detail / collision /
 * objects / above / lights). Town core is concrete/road with grass + weeds
 * breaking through; grass fields only at the edges; a derelict civic plaza with
 * a dead terminal is the hero shot; buildings line the streets.
 *
 * Deterministic: a fixed-seed LCG drives all scatter, so re-running reproduces a
 * byte-identical file. Run via `pnpm --filter @crypto-valley/web gen:map` (needs
 * the committed tileset manifest; regenerate the atlas first if it changed).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const EMPTY = 0;
const ground = new Array<number>(W * H).fill(EMPTY);
const groundDetail = new Array<number>(W * H).fill(EMPTY);
const collision = new Array<number>(W * H).fill(EMPTY);
const above = new Array<number>(W * H).fill(EMPTY);
const at = (x: number, y: number): number => y * W + x;
const inBounds = (x: number, y: number): boolean => x >= 0 && x < W && y >= 0 && y < H;

const MARK = gid("collision_marker");

// ============================================================ regions
const WATER_W = 3; // x0-2 water, x3 shore
const GRASS_W = 8; // grass buffer ends here (x4-7 grass near the water)
const CORE = { x0: GRASS_W, y0: 5, x1: 52, y1: 45 }; // concrete town core
const PLAZA = { x0: 23, y0: 14, x1: 39, y1: 30 };
const ROAD_VX = 30; // vertical street cols 30-31
const ROAD_HY = 22; // horizontal street rows 22-23

const inCore = (x: number, y: number): boolean =>
  x >= CORE.x0 && x <= CORE.x1 && y >= CORE.y0 && y <= CORE.y1;
const inPlaza = (x: number, y: number): boolean =>
  x >= PLAZA.x0 && x <= PLAZA.x1 && y >= PLAZA.y0 && y <= PLAZA.y1;
const onRoad = (x: number, y: number): boolean =>
  (x === ROAD_VX || x === ROAD_VX + 1 || y === ROAD_HY || y === ROAD_HY + 1) &&
  inCore(x, y);

// ============================================================ ground
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (x < WATER_W) ground[at(x, y)] = gid("water");
    else if (x === WATER_W) ground[at(x, y)] = gid("shore_west");
    else if (inCore(x, y)) ground[at(x, y)] = gid("concrete");
    else ground[at(x, y)] = chance(0.12) ? gid("grass_b") : gid("grass");
  }
}
// roads
for (let y = CORE.y0; y <= CORE.y1; y++) {
  for (const x of [ROAD_VX, ROAD_VX + 1]) {
    ground[at(x, y)] = gid("road");
    if (x === ROAD_VX && y % 3 === 0) ground[at(x, y)] = gid("road_line");
  }
}
for (let x = CORE.x0; x <= CORE.x1; x++) {
  for (const y of [ROAD_HY, ROAD_HY + 1]) {
    ground[at(x, y)] = gid("road");
    if (y === ROAD_HY && x % 3 === 0) ground[at(x, y)] = gid("road_line");
  }
}
// plaza: broken concrete, three light variants mixed
for (let y = PLAZA.y0; y <= PLAZA.y1; y++) {
  for (let x = PLAZA.x0; x <= PLAZA.x1; x++) {
    const r = rng();
    ground[at(x, y)] = gid(r < 0.22 ? "concrete_b" : r < 0.4 ? "concrete_c" : "concrete");
  }
}
// worn-concrete variation across the core (broken pavement, not uniform)
for (let y = CORE.y0; y <= CORE.y1; y++) {
  for (let x = CORE.x0; x <= CORE.x1; x++) {
    if (ground[at(x, y)] === gid("concrete") && !onRoad(x, y) && chance(0.14)) {
      ground[at(x, y)] = chance(0.5) ? gid("concrete_b") : gid("concrete_c");
    }
  }
}

// grass invading the core — clumps near the edges
for (let i = 0; i < 26; i++) {
  const cx = CORE.x0 + Math.floor(rng() * (CORE.x1 - CORE.x0));
  const cy = CORE.y0 + Math.floor(rng() * (CORE.y1 - CORE.y0));
  const r = 1 + Math.floor(rng() * 2);
  const edgeBias = Math.min(cx - CORE.x0, CORE.x1 - cx, cy - CORE.y0, CORE.y1 - cy);
  if (edgeBias > 8 && !chance(0.25)) continue; // grass favours edges
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (!inCore(x, y) || onRoad(x, y) || inPlaza(x, y)) continue;
      if (dx * dx + dy * dy <= r * r && chance(0.7)) {
        ground[at(x, y)] = chance(0.3) ? gid("grass_b") : gid("grass");
      }
    }
  }
}

// ============================================================ objects
interface Marker {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  kind?: string;
}
const markers: Marker[] = [];
const lights: Marker[] = [];
let markerId = 1;
const px = (t: number): number => t * TILE;

/** Building: full-footprint collision; roof rows render on `above`, the rest on
 *  ground_detail; a warm window light is registered at the front. */
function stampBuilding(name: string, tx: number, ty: number): void {
  const { w, h } = objSize(name);
  const aboveRows = Math.max(1, Math.min(h - 1, Math.round(h * 0.5)));
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (!inBounds(x, y)) throw new Error(`${name} OOB at ${x},${y}`);
      const g = objGid(name, dx, dy);
      if (dy < aboveRows) above[at(x, y)] = g;
      else groundDetail[at(x, y)] = g;
      collision[at(x, y)] = MARK;
    }
  }
  // warm window light at the front face, slightly inset
  lights.push({
    id: markerId++,
    name: `win_${name}_${tx}`,
    type: "light",
    x: px(tx + w / 2),
    y: px(ty + h - 2),
    kind: "window",
  });
}

/** Tree: trunk row collides; the canopy renders on `above` (player walks behind). */
function stampTree(name: string, tx: number, ty: number): void {
  const { w, h } = objSize(name);
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (!inBounds(x, y)) throw new Error(`${name} OOB at ${x},${y}`);
      const g = objGid(name, dx, dy);
      if (dy < h - 1) above[at(x, y)] = g;
      else {
        groundDetail[at(x, y)] = g;
        collision[at(x, y)] = MARK;
      }
    }
  }
}

/** Small street prop: bottom row collides; top row (if tall) renders on `above`. */
function stampProp(name: string, tx: number, ty: number): void {
  const { w, h } = objSize(name);
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (!inBounds(x, y)) continue;
      const g = objGid(name, dx, dy);
      if (h >= 3 && dy === 0) above[at(x, y)] = g;
      else groundDetail[at(x, y)] = g;
      if (dy === h - 1) collision[at(x, y)] = MARK;
    }
  }
}

// Buildings lining the streets (fronts face south onto the plaza / streets).
stampBuilding("market_med", 9, 3); // x9-15
stampBuilding("market_small", 17, 4); // x17-21
stampBuilding("junk_shack", 24, 3); // x24-29 (just N of plaza, W of road)
stampBuilding("container_house", 33, 4); // x33-37 (E of road)
stampBuilding("power_house", 41, 3); // x41-47
stampBuilding("container_house", 47, 39); // south district
stampBuilding("junk_shack", 10, 39); // south district

// Trees: plaza corners + scattered through the core.
const trees: Array<[string, number, number]> = [
  ["tree_a", 21, 12],
  ["tree_b", 38, 12],
  ["tree_a", 21, 29],
  ["tree_b", 38, 28],
  ["tree_b", 13, 26],
  ["tree_a", 49, 24],
  ["tree_a", 34, 42],
  ["tree_b", 6, 16],
];
for (const [k, x, y] of trees) stampTree(k, x, y);

// ---- the plaza hero: dead terminal (centre), benches, lamp cluster, planters
const TERM = { tx: 30, ty: 20 }; // 2x3
const termBaseX = px(TERM.tx + 1);
const termBaseY = px(TERM.ty + 3);
const termScreenY = px(TERM.ty) + 12;
// collision footprint for the terminal base (sprite is drawn by WorldScene)
collision[at(TERM.tx, TERM.ty + 2)] = MARK;
collision[at(TERM.tx + 1, TERM.ty + 2)] = MARK;
markers.push({ id: markerId++, name: "terminal", type: "terminal", x: termBaseX, y: termBaseY, kind: "terminal" });
lights.push({ id: markerId++, name: "terminal_glow", type: "light", x: termBaseX, y: termScreenY, kind: "terminal" });

stampProp("bench", 25, 18);
stampProp("bench", 34, 26);
stampProp("flower_bush", 26, 26);
stampProp("flower_bush", 36, 18);
stampProp("street_lamp", 24, 16);
stampProp("street_lamp", 38, 27);
lights.push({ id: markerId++, name: "lamp_nw", type: "light", x: px(24) + 8, y: px(16) + 8, kind: "lamp" });
lights.push({ id: markerId++, name: "lamp_se", type: "light", x: px(38) + 8, y: px(27) + 8, kind: "lamp" });

// Street furniture + debris around the core (deliberate near roads).
stampProp("antenna", 44, 12);
stampProp("electric_box", 28, 32);
stampProp("hydrant", 22, 24);
stampProp("hydrant", 41, 21);
const debris: Array<[string, number, number]> = [
  ["barrel", 27, 12],
  ["barrel", 35, 33],
  ["scrap", 15, 33],
  ["scrap", 45, 26],
  ["trash", 33, 17],
  ["trash", 26, 33],
  ["trash", 43, 33],
  ["barrel", 19, 17],
];
for (const [k, x, y] of debris) stampProp(k, x, y);

// ============================================================ ground detail
// Weeds / flowers / cracks breaking through pavement (art bible Law 2).
const WEEDS = ["weed_a", "weed_b", "shrub_a", "shrub_b"];
const FLOWERS = ["flower_a", "flower_b", "flower_c"];
const CRACKS = ["crack_a", "crack_b"];
function scatterDetail(x: number, y: number): void {
  if (groundDetail[at(x, y)] !== EMPTY || collision[at(x, y)] !== EMPTY) return;
  const onPavement = !inPlaza(x, y) ? inCore(x, y) : true;
  const isGrass = ground[at(x, y)] === gid("grass") || ground[at(x, y)] === gid("grass_b");
  // denser near plaza + roads
  const nearHot = inPlaza(x, y) || onRoad(x, y) || (Math.abs(x - 30) < 6 && Math.abs(y - 22) < 9);
  const base = isGrass ? 0.16 : nearHot ? 0.22 : 0.14;
  if (!chance(base)) return;
  const roll = rng();
  if (isGrass) {
    groundDetail[at(x, y)] = gid(roll < 0.6 ? pick(WEEDS) : pick(FLOWERS));
  } else if (onPavement) {
    groundDetail[at(x, y)] =
      roll < 0.18 ? gid(pick(CRACKS)) : roll < 0.72 ? gid(pick(WEEDS)) : gid(pick(FLOWERS));
  }
}
for (let y = 0; y < H; y++) for (let x = WATER_W + 1; x < W; x++) scatterDetail(x, y);

// occasional manhole / grate on roads + plaza
for (const [x, y] of [
  [ROAD_VX, 10],
  [ROAD_VX + 1, 33],
  [31, 25],
  [27, 23],
  [44, 23],
] as Array<[number, number]>) {
  if (collision[at(x, y)] === EMPTY) groundDetail[at(x, y)] = gid(chance(0.5) ? "manhole" : "grate");
}

// Density guarantee: no bare 4x4 area in the town core (the #1 complaint).
for (let by = CORE.y0; by + 3 <= CORE.y1; by += 4) {
  for (let bx = CORE.x0; bx + 3 <= CORE.x1; bx += 4) {
    let occupied = 0;
    for (let dy = 0; dy < 4; dy++) {
      for (let dx = 0; dx < 4; dx++) {
        if (groundDetail[at(bx + dx, by + dy)] !== EMPTY || collision[at(bx + dx, by + dy)] !== EMPTY) {
          occupied++;
        }
      }
    }
    if (occupied === 0) {
      // place a deliberate weed/crack in a seeded cell of the block
      const cx = bx + 1 + Math.floor(rng() * 2);
      const cy = by + 1 + Math.floor(rng() * 2);
      const pavement = !(ground[at(cx, cy)] === gid("grass") || ground[at(cx, cy)] === gid("grass_b"));
      groundDetail[at(cx, cy)] = gid(pavement ? pick([...CRACKS, "weed_a"]) : pick(WEEDS));
    }
  }
}

// ============================================================ collision ring
for (let y = 0; y < H; y++) for (let x = 0; x < WATER_W; x++) collision[at(x, y)] = MARK;
for (let x = 0; x < W; x++) {
  collision[at(x, 0)] = MARK;
  collision[at(x, H - 1)] = MARK;
}
for (let y = 0; y < H; y++) collision[at(W - 1, y)] = MARK;

// ============================================================ markers + lights
markers.unshift({ id: markerId++, name: "spawn", type: "spawn", x: px(31), y: px(28) });
markers.push({ id: markerId++, name: "door_market_med", type: "door", x: px(12), y: px(11) });
markers.push({ id: markerId++, name: "door_market_small", type: "door", x: px(19), y: px(11) });

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
    point: true,
    visible: true,
    rotation: 0,
    properties: o.kind ? [{ name: "kind", type: "string", value: o.kind }] : [],
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
console.log(`wrote town.tmj (${W}x${H}); ${markers.length} markers, ${lights.length} lights`);

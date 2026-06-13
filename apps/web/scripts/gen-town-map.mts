/**
 * Generates apps/web/public/assets/maps/town.tmj — a 60x50, 16px, Tiled-format
 * JSON map with the six standard layers from CLAUDE.md:
 *   ground / ground_detail / collision / objects / above / lights
 *
 * Tile layers: ground, ground_detail, collision (invisible marker tiles), above.
 * Object layers: objects (spawn/door markers), lights (point-light markers).
 *
 * Deterministic: scatter detail uses a fixed-seed LCG, so re-running the script
 * reproduces the identical map. Run via `pnpm --filter @crypto-valley/web gen:map`
 * (requires the committed tileset manifest; regenerate it first if you changed
 * the atlas).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const TILESET_DIR = join(here, "../public/assets/tilesets");
const OUT_DIR = join(here, "../public/assets/maps");

interface Manifest {
  image: string;
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

/** Atlas index -> Tiled gid. */
const gid = (name: string): number => {
  const idx = manifest.tiles[name];
  if (idx === undefined) throw new Error(`unknown tile: ${name}`);
  return idx + FIRSTGID;
};
/** Gid of the (dx,dy) cell inside a multi-tile object. */
const objGid = (name: string, dx: number, dy: number): number => {
  const o = manifest.objects[name];
  if (!o) throw new Error(`unknown object: ${name}`);
  return (o.row + dy) * manifest.columns + (o.col + dx) + FIRSTGID;
};

// Deterministic LCG so the map is identical on every run.
let rngState = 0xc0ffee;
const rng = (): number => {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 0x100000000;
};

const EMPTY = 0;
const ground: number[] = new Array(W * H).fill(EMPTY);
const groundDetail: number[] = new Array(W * H).fill(EMPTY);
const collision: number[] = new Array(W * H).fill(EMPTY);
const above: number[] = new Array(W * H).fill(EMPTY);

const at = (x: number, y: number): number => y * W + x;
const inBounds = (x: number, y: number): boolean => x >= 0 && x < W && y >= 0 && y < H;

// ---- ground: grass everywhere, water along the west edge ------------------
const WATER_W = 3; // x = 0..2 water, x = 3 shoreline
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (x < WATER_W) ground[at(x, y)] = gid("water");
    else if (x === WATER_W) ground[at(x, y)] = gid("shore_west");
    else ground[at(x, y)] = gid("grass");
  }
}

// ---- roads: one horizontal, one vertical, meeting at the plaza ------------
const ROAD_H_Y = 23; // rows 23-24
const ROAD_V_X = 29; // cols 29-30
for (let x = WATER_W + 1; x < W; x++) {
  ground[at(x, ROAD_H_Y)] = gid("dirt");
  ground[at(x, ROAD_H_Y + 1)] = gid("dirt");
}
for (let y = 4; y < H - 4; y++) {
  ground[at(ROAD_V_X, y)] = gid("dirt");
  ground[at(ROAD_V_X + 1, y)] = gid("dirt");
}

// ---- central plaza (paints over the road crossing) ------------------------
const PLAZA = { x0: 24, y0: 19, x1: 35, y1: 28 };
for (let y = PLAZA.y0; y <= PLAZA.y1; y++) {
  for (let x = PLAZA.x0; x <= PLAZA.x1; x++) {
    ground[at(x, y)] = gid("plaza");
  }
}

// ---- scattered ground detail (deterministic) ------------------------------
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const g = ground[at(x, y)];
    if (g === gid("grass") && rng() < 0.05) {
      groundDetail[at(x, y)] =
        rng() < 0.5 ? gid("grass_tuft_a") : gid("grass_tuft_b");
    } else if (g === gid("dirt") && rng() < 0.07) {
      groundDetail[at(x, y)] =
        rng() < 0.5 ? gid("dirt_detail_a") : gid("dirt_detail_b");
    }
  }
}

// ---- multi-tile objects ----------------------------------------------------
/**
 * Stamps an object: the bottom `solidRows` rows go to ground_detail + collision
 * (building bodies / trunks), the rows above go to the "above" layer (roofs /
 * canopies) so the player walking the tiles behind them is occluded.
 */
function stamp(
  name: string,
  tx: number,
  ty: number,
  solidRows: number,
  opts: { collideFromCol?: number; collideToCol?: number } = {},
): void {
  const o = manifest.objects[name];
  if (!o) throw new Error(`unknown object: ${name}`);
  const splitY = o.h - solidRows;
  for (let dy = 0; dy < o.h; dy++) {
    for (let dx = 0; dx < o.w; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (!inBounds(x, y)) throw new Error(`${name} out of bounds at ${x},${y}`);
      const g = objGid(name, dx, dy);
      if (dy >= splitY) {
        groundDetail[at(x, y)] = g;
        const fromCol = opts.collideFromCol ?? 0;
        const toCol = opts.collideToCol ?? o.w - 1;
        if (dx >= fromCol && dx <= toCol) collision[at(x, y)] = gid("collision_marker");
      } else {
        above[at(x, y)] = g;
      }
    }
  }
}

// Houses (10x6): bottom 4 rows solid, top 2 rows overhang ("above").
stamp("house_a", 9, 7, 4);
stamp("house_b", 38, 32, 4);
// Tent (4x4): bottom 3 rows solid.
stamp("tent", 44, 11, 3);
// Trees (2x3): bottom row = trunk (collides), top 2 rows = canopy.
const TREES: Array<[string, number, number]> = [
  ["tree_a", 8, 29],
  ["tree_b", 20, 13],
  ["tree_a", 40, 19],
  ["tree_b", 14, 39],
];
for (const [kind, tx, ty] of TREES) stamp(kind, tx, ty, 1);

// ---- collision: water + map border ring -----------------------------------
for (let y = 0; y < H; y++) {
  for (let x = 0; x < WATER_W; x++) collision[at(x, y)] = gid("collision_marker");
}
for (let x = 0; x < W; x++) {
  collision[at(x, 0)] = gid("collision_marker");
  collision[at(x, H - 1)] = gid("collision_marker");
}
for (let y = 0; y < H; y++) {
  collision[at(W - 1, y)] = gid("collision_marker");
}

// ---- object + light markers -------------------------------------------------
const px = (tx: number): number => tx * TILE;
const markers = [
  { id: 1, name: "spawn", type: "spawn", point: true, x: px(30), y: px(26), visible: true, rotation: 0 },
  { id: 2, name: "door_house_a", type: "door", point: true, x: px(14), y: px(13), visible: true, rotation: 0 },
  { id: 3, name: "door_house_b", type: "door", point: true, x: px(43), y: px(38), visible: true, rotation: 0 },
];
const lights = [
  { id: 10, name: "plaza_light_nw", type: "light", point: true, x: px(25), y: px(20), visible: true, rotation: 0 },
  { id: 11, name: "plaza_light_se", type: "light", point: true, x: px(35), y: px(28), visible: true, rotation: 0 },
];

// ---- assemble Tiled map ------------------------------------------------------
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
const objectLayer = (name: string, objects: unknown[]) => ({
  id: layerId++,
  name,
  type: "objectgroup" as const,
  x: 0,
  y: 0,
  opacity: 1,
  visible: true,
  draworder: "topdown" as const,
  objects,
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
  nextobjectid: 99,
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
console.log(`wrote ${join(OUT_DIR, "town.tmj")} (${W}x${H}, ${map.layers.length} layers)`);

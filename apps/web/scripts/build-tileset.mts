/**
 * Composes apps/web/public/assets/tilesets/town_tiles.png (+ .manifest.json)
 * from individually-named LimeZu "Singles" tiles in /assets-src.
 *
 * Repeatable: run `pnpm --filter @crypto-valley/web gen:tileset` (or via tsx)
 * from a checkout that contains /assets-src. The committed PNG/manifest are the
 * build artifacts the game actually loads — never import from assets-src.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const SRC = join(repoRoot, "assets-src");
const EXT = join(SRC, "modernexteriors-win/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16");
const OUT_DIR = join(here, "../public/assets/tilesets");

const TILE = 16;
const COLS = 16; // atlas width in tiles

const terrains = join(EXT, "1_Terrains_and_Fences_Singles_16x16");
const city = join(EXT, "2_City_Terrains_Singles_16x16");
const props = join(EXT, "3_City_Props_Singles_16x16");
const camping = join(EXT, "11_Camping_Singles_16x16");

const tf = (n: string) => join(terrains, `ME_Singles_Terrains_and_Fences_16x16_${n}.png`);
const ct = (n: string) => join(city, `ME_Singles_City_Terrains_16x16_${n}.png`);
const cp = (n: string) => join(props, `ME_Singles_City_Props_16x16_${n}.png`);
const cs = (n: string) => join(camping, `ME_Singles_Camping_16x16_${n}.png`);

/** Single-cell terrain tiles → atlas row 0+, in order (index = atlas position). */
const SINGLE_TILES: Array<{ name: string; file: string }> = [
  { name: "grass", file: tf("Grass_Water_1_23") },
  { name: "grass_detail_a", file: tf("Grass_Water_1_9") },
  { name: "grass_detail_b", file: tf("Grass_Water_1_10") },
  { name: "grass_detail_c", file: tf("Grass_Water_1_17") },
  { name: "water", file: tf("Grass_Water_1_22") },
  { name: "shore_west", file: tf("Grass_Water_1_13") }, // grass with water on its west side
  { name: "dirt", file: tf("Grass_1_21") },
  { name: "plaza", file: ct("Sidewalk_1_9") },
  { name: "dirt_detail_a", file: tf("Props_Dirt_1") },
  { name: "dirt_detail_b", file: tf("Props_Dirt_2") },
  { name: "grass_tuft_a", file: tf("Props_Grass_9") },
  { name: "grass_tuft_b", file: tf("Props_Grass_10") },
];

/** Multi-tile objects → packed left-to-right, top-to-bottom below the singles. */
const OBJECTS: Array<{ name: string; file: string }> = [
  { name: "tree_a", file: cp("Tree_1") }, // 2x3 tiles
  { name: "tree_b", file: cp("Tree_2") }, // 2x3 tiles
  { name: "house_a", file: cs("Mobile_House_Big_1") }, // 10x6 tiles
  { name: "house_b", file: cs("Mobile_House_Big_2") }, // 10x6 tiles
  { name: "tent", file: cs("Tent_1") }, // 4x4 tiles
];

interface ObjectEntry {
  col: number;
  row: number;
  w: number; // tiles
  h: number; // tiles
}

function readPng(file: string): PNG {
  return PNG.sync.read(readFileSync(file));
}

function blit(dst: PNG, src: PNG, dx: number, dy: number): void {
  PNG.bitblt(src, dst, 0, 0, src.width, src.height, dx, dy);
}

// ---- layout pass: figure out atlas height -------------------------------
const objectPngs = OBJECTS.map((o) => ({ ...o, png: readPng(o.file) }));
for (const o of objectPngs) {
  if (o.png.width % TILE !== 0 || o.png.height % TILE !== 0) {
    throw new Error(`${o.name}: ${o.png.width}x${o.png.height} is not a multiple of ${TILE}`);
  }
}

let cursorCol = 0;
let cursorRow = 2; // row 0 = singles, row 1 = reserved (collision marker)
let rowHeight = 0;
const objectEntries: Record<string, ObjectEntry> = {};
for (const o of objectPngs) {
  const w = o.png.width / TILE;
  const h = o.png.height / TILE;
  if (cursorCol + w > COLS) {
    cursorCol = 0;
    cursorRow += rowHeight;
    rowHeight = 0;
  }
  objectEntries[o.name] = { col: cursorCol, row: cursorRow, w, h };
  cursorCol += w;
  rowHeight = Math.max(rowHeight, h);
}
const ROWS = cursorRow + rowHeight;

// ---- compose -------------------------------------------------------------
const atlas = new PNG({ width: COLS * TILE, height: ROWS * TILE });

const tileIndex: Record<string, number> = {};
SINGLE_TILES.forEach((t, i) => {
  const png = readPng(t.file);
  if (png.width !== TILE || png.height !== TILE) {
    throw new Error(`${t.name}: expected ${TILE}x${TILE}, got ${png.width}x${png.height}`);
  }
  blit(atlas, png, i * TILE, 0);
  tileIndex[t.name] = i;
});

// Synthesized collision marker tile at row 1, col 0 (rendered invisible in-game).
const COLLISION_INDEX = COLS * 1;
for (let y = 0; y < TILE; y++) {
  for (let x = 0; x < TILE; x++) {
    const idx = ((1 * TILE + y) * atlas.width + x) * 4;
    atlas.data[idx] = 255;
    atlas.data[idx + 1] = 0;
    atlas.data[idx + 2] = 255;
    atlas.data[idx + 3] = 140;
  }
}
tileIndex["collision_marker"] = COLLISION_INDEX;

for (const o of objectPngs) {
  const e = objectEntries[o.name];
  blit(atlas, o.png, e.col * TILE, e.row * TILE);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "town_tiles.png"), PNG.sync.write(atlas));

const manifest = {
  image: "town_tiles.png",
  tileSize: TILE,
  columns: COLS,
  rows: ROWS,
  tiles: tileIndex,
  objects: objectEntries,
};
writeFileSync(join(OUT_DIR, "town_tiles.manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`atlas: ${COLS * TILE}x${ROWS * TILE} (${COLS}x${ROWS} tiles)`);
console.log(`tiles: ${Object.keys(tileIndex).length} singles, objects: ${Object.keys(objectEntries).length}`);
console.log(`wrote ${join(OUT_DIR, "town_tiles.png")}`);

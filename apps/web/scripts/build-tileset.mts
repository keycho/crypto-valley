/**
 * Composes apps/web/public/assets/tilesets/town_tiles.png (+ .manifest.json)
 * for the "Overgrown Terminal" town from LimeZu "Singles" tiles in /assets-src,
 * applying the art-bible palette shift (tools/palette-shift) at build time.
 *
 * Repeatable: `pnpm --filter @crypto-valley/web gen:tileset`. The committed PNG +
 * manifest are what the game loads — assets-src is never imported at runtime, and
 * the palette shift is never baked into the source archive.
 *
 * Layout:
 *   row 0          1x1 terrain + 1x1 decor tiles (index = column)
 *   row 1 col 0    synthesized translucent collision marker
 *   rows 2+        multi-tile objects, packed and recorded in the manifest
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

import {
  applyPaletteShift,
  type PaletteMapping,
} from "../../../tools/palette-shift/palette-shift.mts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const EXT = join(
  repoRoot,
  "assets-src/modernexteriors-win/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16",
);
const OUT_DIR = join(here, "../public/assets/tilesets");
const MAPPING: PaletteMapping = JSON.parse(
  readFileSync(join(repoRoot, "tools/palette-shift/mapping.json"), "utf8"),
);

const TILE = 16;
const COLS = 16;

const terrains = join(EXT, "1_Terrains_and_Fences_Singles_16x16");
const city = join(EXT, "2_City_Terrains_Singles_16x16");
const props = join(EXT, "3_City_Props_Singles_16x16");
const camping = join(EXT, "11_Camping_Singles_16x16");
const shops = join(EXT, "9_Shopping_Center_and_Markets_Singles_16x16");

const tf = (n: string) => join(terrains, `ME_Singles_Terrains_and_Fences_16x16_${n}.png`);
const ct = (n: string) => join(city, `ME_Singles_City_Terrains_16x16_${n}.png`);
const cp = (n: string) => join(props, `ME_Singles_City_Props_16x16_${n}.png`);
const cs = (n: string) => join(camping, `ME_Singles_Camping_16x16_${n}.png`);
const sh = (n: string) => join(shops, `ME_Singles_Shopping_Center_and_Markets_16x16_${n}.png`);

function readPng(file: string): PNG {
  return PNG.sync.read(readFileSync(file));
}
function blit(dst: PNG, src: PNG, dx: number, dy: number): void {
  PNG.bitblt(src, dst, 0, 0, src.width, src.height, dx, dy);
}
function setPx(p: PNG, x: number, y: number, [r, g, b, a]: [number, number, number, number]): void {
  if (x < 0 || y < 0 || x >= p.width || y >= p.height) return;
  const i = (y * p.width + x) * 4;
  p.data[i] = r;
  p.data[i + 1] = g;
  p.data[i + 2] = b;
  p.data[i + 3] = a;
}
function fillRect(p: PNG, x0: number, y0: number, w: number, h: number, c: [number, number, number, number]): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPx(p, x, y, c);
}

// ---- 1x1 terrain + decor singles -------------------------------------------
const SINGLE_TILES: Array<{ name: string; file: string }> = [
  { name: "grass", file: tf("Grass_Water_1_23") },
  { name: "grass_b", file: tf("Grass_Water_1_9") },
  { name: "grass_c", file: tf("Grass_Water_1_17") },
  { name: "water", file: tf("Grass_Water_1_22") },
  { name: "shore_west", file: tf("Grass_Water_1_13") },
  { name: "concrete", file: ct("Sidewalk_1_9") },
  { name: "road", file: ct("Asphalt_1_Variation_2") },
  { name: "road_line", file: ct("Asphalt_1_Variation_5") },
  // overgrowth + street decor (1x1), layered on ground_detail
  { name: "weed_a", file: tf("Props_Grass_9") },
  { name: "weed_b", file: tf("Props_Grass_10") },
  { name: "flower_a", file: cp("Flowers_1") },
  { name: "flower_b", file: cp("Flowers_2") },
  { name: "flower_c", file: cp("Flowers_3") },
  { name: "shrub_a", file: cp("Shrub_1") },
  { name: "shrub_b", file: cp("Shrub_2") },
  { name: "manhole", file: cp("Manhole_1") },
  { name: "grate", file: cp("Grate_1") },
];

// ---- multi-tile objects -----------------------------------------------------
const OBJECTS: Array<{ name: string; file: string }> = [
  { name: "tree_a", file: cp("Tree_1") },
  { name: "tree_b", file: cp("Tree_2") },
  { name: "market_small", file: sh("Market_Small_1") },
  { name: "market_med", file: sh("Market_Medium_1") },
  { name: "container_house", file: cp("Container_House_1") },
  { name: "junk_shack", file: cp("Junk_Shack_1") },
  { name: "power_house", file: cp("Power_House_1") },
  { name: "street_lamp", file: cp("Street_Lamp_1") },
  { name: "antenna", file: cp("Antenna.png") },
  { name: "bench", file: cp("Bench_2") },
  { name: "electric_box", file: cp("Electric_Box_1") },
  { name: "hydrant", file: cp("Hydrant_1") },
  { name: "flower_bush", file: cp("Flower_Bush_1") },
  { name: "barrel", file: cp("Brown_Barrel_1") },
  { name: "scrap", file: cp("Scrap_Metal_Pile_1") },
  { name: "trash", file: cp("Small_Trash_Pile_1") },
  { name: "tent", file: cs("Tent_1") },
];

interface ObjectEntry {
  col: number;
  row: number;
  w: number;
  h: number;
}

// A few extras have ".png" already baked into the helper name; normalise.
const fixName = (f: string) => f.replace(".png.png", ".png");

const objectPngs = OBJECTS.map((o) => ({ ...o, png: readPng(fixName(o.file)) }));
for (const o of objectPngs) {
  if (o.png.width % TILE !== 0 || o.png.height % TILE !== 0) {
    throw new Error(`${o.name}: ${o.png.width}x${o.png.height} not a multiple of ${TILE}`);
  }
}

// ---- synthesized objects: crack decals + flickering terminal -----------------
// Crack-with-weed decals (art bible §5 "overgrowth overlays") — 1x1, drawn on a
// transparent tile so they layer over concrete.
function makeCrack(seed: number, withWeed: boolean): PNG {
  const p = new PNG({ width: TILE, height: TILE });
  p.data.fill(0);
  // a subtle warm hairline (not black), low alpha, so it reads as a crack not a stick
  let x = 4 + (seed % 4);
  let y = 3;
  const len = withWeed ? 7 : 9;
  for (let step = 0; step < len; step++) {
    setPx(p, x, y, [120, 104, 88, 120]);
    setPx(p, x, y + 1, [96, 82, 68, 80]);
    y += 1;
    x += ((seed >> step) & 1) === 0 ? 1 : 0; // gentle drift
    x = Math.max(1, Math.min(TILE - 2, x));
    if (y >= TILE - 3) break;
  }
  if (withWeed) {
    fillRect(p, 7, 9, 1, 4, [111, 160, 90, 210]);
    setPx(p, 6, 11, [123, 176, 99, 200]);
    setPx(p, 8, 10, [123, 176, 99, 200]);
  }
  return p;
}

function clonePng(src: PNG): PNG {
  const p = new PNG({ width: src.width, height: src.height });
  src.data.copy(p.data);
  return p;
}

/** A light worn-pavement variant: base concrete + subtle stains, a faint seam,
 *  and a moss speck. Stays light (no dark gaps), deterministic per seed. */
function makeWornConcrete(base: PNG, seed: number): PNG {
  const p = clonePng(base);
  let s = (seed * 2654435761) >>> 0;
  const next = (): number => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
  // darken a handful of pixels (stains)
  for (let n = 0; n < 18; n++) {
    const x = Math.floor(next() * TILE);
    const y = Math.floor(next() * TILE);
    const i = (y * TILE + x) * 4;
    p.data[i] = Math.round(p.data[i] * 0.86);
    p.data[i + 1] = Math.round(p.data[i + 1] * 0.86);
    p.data[i + 2] = Math.round(p.data[i + 2] * 0.86);
  }
  // a faint diagonal seam
  let cx = 2 + Math.floor(next() * 4);
  for (let cy = 2; cy < TILE - 2; cy++) {
    const i = (cy * TILE + cx) * 4;
    p.data[i] = Math.round(p.data[i] * 0.82);
    p.data[i + 1] = Math.round(p.data[i + 1] * 0.82);
    p.data[i + 2] = Math.round(p.data[i + 2] * 0.82);
    if (next() < 0.5) cx = Math.min(TILE - 2, cx + 1);
  }
  // a moss speck (overgrowth, art bible Law 2)
  const mx = 3 + Math.floor(next() * (TILE - 6));
  const my = 3 + Math.floor(next() * (TILE - 6));
  setPx(p, mx, my, [111, 160, 90, 255]);
  setPx(p, mx + 1, my, [90, 132, 74, 255]);
  setPx(p, mx, my + 1, [90, 132, 74, 255]);
  return p;
}

// Terminal: a freestanding civic kiosk, 2x3 (32x48). The screen is the only
// cold-glow source in town — drawn dead (#1A1D24) and live (#34D399) so Phaser
// can flicker between the two frames. Drawn directly on the §2 palette.
function makeTerminal(screen: "off" | "on"): PNG {
  const W = TILE * 2;
  const H = TILE * 3;
  const p = new PNG({ width: W, height: H });
  p.data.fill(0);
  const OUTLINE: [number, number, number, number] = [58, 46, 38, 255]; // #3A2E26
  const CASE_D: [number, number, number, number] = [92, 74, 61, 255]; // #5C4A3D
  const CASE_M: [number, number, number, number] = [140, 130, 118, 255]; // #8C8276
  const CASE_L: [number, number, number, number] = [200, 160, 107, 255]; // #C8A06B rim
  // monitor body x[2..30] y[2..30]
  fillRect(p, 3, 2, 26, 28, CASE_M);
  fillRect(p, 3, 2, 26, 2, CASE_L);
  fillRect(p, 3, 26, 26, 4, CASE_D);
  // outline
  for (let x = 2; x <= 29; x++) {
    setPx(p, x, 1, OUTLINE);
    setPx(p, x, 30, OUTLINE);
  }
  for (let y = 1; y <= 30; y++) {
    setPx(p, 2, y, OUTLINE);
    setPx(p, 29, y, OUTLINE);
  }
  // screen inset x[6..26] y[6..22]
  fillRect(p, 5, 5, 22, 18, OUTLINE);
  if (screen === "off") {
    fillRect(p, 6, 6, 20, 16, [26, 29, 36, 255]); // #1A1D24
    for (let y = 6; y < 22; y += 2) fillRect(p, 6, y, 20, 1, [34, 38, 48, 255]); // scanlines
  } else {
    fillRect(p, 6, 6, 20, 16, [20, 83, 61, 255]); // dim green base
    for (let y = 6; y < 22; y += 2) fillRect(p, 6, y, 20, 1, [52, 211, 153, 255]); // #34D399 lines
    // a couple of bright glyph pixels
    fillRect(p, 9, 10, 8, 1, [167, 243, 208, 255]); // #A7F3D0
    fillRect(p, 9, 14, 5, 1, [167, 243, 208, 255]);
    fillRect(p, 9, 18, 10, 1, [167, 243, 208, 255]);
  }
  // post + base
  fillRect(p, 13, 30, 6, 14, CASE_D);
  setPx(p, 12, 30, OUTLINE);
  setPx(p, 19, 30, OUTLINE);
  fillRect(p, 8, 44, 16, 3, CASE_M);
  fillRect(p, 8, 46, 16, 1, OUTLINE);
  return p;
}

const baseConcrete = readPng(ct("Sidewalk_1_9"));
const synthObjects: Array<{ name: string; png: PNG }> = [
  { name: "concrete_b", png: makeWornConcrete(baseConcrete, 7) },
  { name: "concrete_c", png: makeWornConcrete(baseConcrete, 23) },
  { name: "crack_a", png: makeCrack(1, false) },
  { name: "crack_b", png: makeCrack(2, true) },
];

// The terminal ships as its own 2-frame spritesheet (off | on) so Phaser can
// flicker the screen; it is NOT part of the static tile atlas.
function writeTerminalSheet(): void {
  const off = makeTerminal("off");
  const on = makeTerminal("on");
  const sheet = new PNG({ width: TILE * 4, height: TILE * 3 });
  sheet.data.fill(0);
  blit(sheet, off, 0, 0);
  blit(sheet, on, TILE * 2, 0);
  applyPaletteShift(sheet, MAPPING);
  const spriteDir = join(here, "../public/assets/sprites");
  mkdirSync(spriteDir, { recursive: true });
  writeFileSync(join(spriteDir, "terminal.png"), PNG.sync.write(sheet));
}

// crack tiles are 1x1 -> treat as singles appended after the file singles
const synthSingles = synthObjects.filter((o) => o.png.width === TILE && o.png.height === TILE);
const synthMulti = synthObjects.filter((o) => !(o.png.width === TILE && o.png.height === TILE));

// Singles (file + synth 1x1) wrap across as many rows as needed; the collision
// marker and the multi-tile objects are placed below them.
const singleSources = [
  ...SINGLE_TILES.map((t) => ({ name: t.name, png: readPng(t.file) })),
  ...synthSingles.map((s) => ({ name: s.name, png: s.png })),
];
const singleRows = Math.ceil(singleSources.length / COLS);
const COLLISION_INDEX = singleRows * COLS; // first cell of the row after the singles

// ---- layout objects (file + synth multi), starting below singles + marker ---
const allObjects = [
  ...objectPngs.map((o) => ({ name: o.name, png: o.png })),
  ...synthMulti,
];
let cursorCol = 0;
let cursorRow = singleRows + 1;
let rowHeight = 0;
const objectEntries: Record<string, ObjectEntry> = {};
for (const o of allObjects) {
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

// ---- compose ----------------------------------------------------------------
const atlas = new PNG({ width: COLS * TILE, height: ROWS * TILE });
atlas.data.fill(0);
const tileIndex: Record<string, number> = {};

singleSources.forEach((t, i) => {
  if (t.png.width !== TILE || t.png.height !== TILE) {
    throw new Error(`${t.name}: expected ${TILE}x${TILE}, got ${t.png.width}x${t.png.height}`);
  }
  blit(atlas, t.png, (i % COLS) * TILE, Math.floor(i / COLS) * TILE);
  tileIndex[t.name] = i;
});

fillRect(atlas, (COLLISION_INDEX % COLS) * TILE, Math.floor(COLLISION_INDEX / COLS) * TILE, TILE, TILE, [255, 0, 255, 140]);
tileIndex["collision_marker"] = COLLISION_INDEX;

for (const o of allObjects) {
  const e = objectEntries[o.name];
  blit(atlas, o.png, e.col * TILE, e.row * TILE);
}

// ---- palette shift (skip synthesized tiles — already on-palette) ------------
// We shift the whole atlas; synth tiles are drawn in §2 colours which are at or
// near the anchor targets, so the nearest-anchor falloff barely moves them.
applyPaletteShift(atlas, MAPPING);

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

writeTerminalSheet();

console.log(`atlas ${COLS * TILE}x${ROWS * TILE} (${COLS}x${ROWS} tiles)`);
console.log(`singles: ${singleSources.length}, objects: ${Object.keys(objectEntries).length}`);
console.log(`wrote sprites/terminal.png (2 frames 32x48)`);

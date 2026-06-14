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
const props = join(EXT, "3_City_Props_Singles_16x16");
const camping = join(EXT, "11_Camping_Singles_16x16");
const shops = join(EXT, "9_Shopping_Center_and_Markets_Singles_16x16");

const tf = (n: string) => join(terrains, `ME_Singles_Terrains_and_Fences_16x16_${n}.png`);
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

// ---- Sunnyside source sheet (16px) -----------------------------------------
// The cozy "Warm Ages" terrain now comes from the LimeZu Sunnyside pack, whose
// ground tiles all live in one 64x64 sheet. We crop named 16x16 tiles by their
// (col,row) on that sheet; props/buildings still come from the per-file sources
// below until they're migrated. Same seed in => same atlas out (no IO at runtime).
const SUN = join(
  repoRoot,
  "assets-src/sunnyside/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets",
);
const SS_SHEET = readPng(join(SUN, "Tileset/spr_tileset_sunnysideworld_16px.png"));
/** Crop a single 16x16 tile from the Sunnyside tileset at tile coords (tx,ty). */
function ssTile(tx: number, ty: number): PNG {
  const p = new PNG({ width: TILE, height: TILE });
  PNG.bitblt(SS_SHEET, p, tx * TILE, ty * TILE, TILE, TILE, 0, 0);
  return p;
}
/** Crop an arbitrary pixel rect from the Sunnyside sheet. */
function ssPx(x: number, y: number, w: number, h: number): PNG {
  const p = new PNG({ width: w, height: h });
  PNG.bitblt(SS_SHEET, p, x, y, w, h, 0, 0);
  return p;
}
/** One frame from a horizontal strip sheet (frames laid left-to-right). */
function stripFrame(sheet: PNG, fw: number, fh: number, idx: number): PNG {
  const p = new PNG({ width: fw, height: fh });
  PNG.bitblt(sheet, p, idx * fw, 0, fw, fh, 0, 0);
  return p;
}
/** Trim fully-transparent borders so a sprite can be re-anchored precisely. */
function tightCrop(src: PNG): PNG {
  let minx = src.width, miny = src.height, maxx = -1, maxy = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (src.data[(y * src.width + x) * 4 + 3] > 16) {
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
  }
  if (maxx < 0) return new PNG({ width: TILE, height: TILE });
  const w = maxx - minx + 1, h = maxy - miny + 1;
  const p = new PNG({ width: w, height: h });
  PNG.bitblt(src, p, minx, miny, w, h, 0, 0);
  return p;
}
/** Place src into a W×H transparent canvas, horizontally centred + bottom-anchored. */
function padBottomCenter(src: PNG, W: number, H: number, bottomMargin = 0): PNG {
  const p = new PNG({ width: W, height: H });
  p.data.fill(0);
  const dx = Math.max(0, Math.round((W - src.width) / 2));
  const dy = Math.max(0, H - src.height - bottomMargin);
  PNG.bitblt(src, p, 0, 0, Math.min(src.width, W), Math.min(src.height, H), dx, dy);
  return p;
}

// Sunnyside decorative sprites, cropped from the pack and re-anchored to our grid.
const SUN_PLANTS = join(SUN, "Elements/Plants");
const ssTree01 = readPng(join(SUN_PLANTS, "spr_deco_tree_01_strip4.png")); // round, 4×(32×34)
const ssTree02 = readPng(join(SUN_PLANTS, "spr_deco_tree_02_strip4.png")); // pine,  4×(28×43)
const treeRoundPng = padBottomCenter(tightCrop(stripFrame(ssTree01, 32, 34, 0)), 32, 48);
const treePinePng = padBottomCenter(tightCrop(stripFrame(ssTree02, 28, 43, 0)), 32, 48);
const bushPng = padBottomCenter(tightCrop(ssPx(433, 18, 15, 21)), 32, 32);
const barrelPng = padBottomCenter(tightCrop(ssPx(690, 158, 12, 22)), 16, 32);
const benchPng = padBottomCenter(tightCrop(ssPx(751, 192, 26, 30)), 32, 32);
const rockPng = tightCrop(ssPx(787, 340, 26, 44)); // grey boulder (gather node)
// Pre-assembled colored-roof cottages for the low building tiers (hut/cabin/house).
const houseHutPng = tightCrop(ssPx(520, 424, 32, 56)); // orange roof (small)
const houseCabinPng = tightCrop(ssPx(520, 680, 32, 56)); // purple roof
const houseHousePng = tightCrop(ssPx(512, 160, 48, 80)); // blue roof (large)

// ---- 1x1 terrain + decor singles -------------------------------------------
const SINGLE_TILES: Array<{ name: string; file?: string; png?: PNG }> = [
  { name: "grass", png: ssTile(1, 1) },
  { name: "grass_b", png: ssTile(3, 2) },
  { name: "grass_c", png: ssTile(5, 2) },
  { name: "water", png: ssTile(4, 1) },
  { name: "shore_west", file: tf("Grass_Water_1_13") },
  { name: "concrete", png: ssTile(5, 1) },
  { name: "road", png: ssTile(11, 3) },
  { name: "road_line", png: ssTile(11, 4) },
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
// Trees + cozy decor come from Sunnyside (inline png); the remaining urban props
// still source from the ME pack until they're migrated or dropped.
const OBJECTS: Array<{ name: string; file?: string; png?: PNG }> = [
  { name: "tree_a", png: treeRoundPng },
  { name: "tree_b", png: treePinePng },
  { name: "market_small", file: sh("Market_Small_1") },
  { name: "market_med", file: sh("Market_Medium_1") },
  { name: "container_house", file: cp("Container_House_1") },
  { name: "junk_shack", file: cp("Junk_Shack_1") },
  { name: "power_house", file: cp("Power_House_1") },
  { name: "street_lamp", file: cp("Street_Lamp_1") },
  { name: "antenna", file: cp("Antenna.png") },
  { name: "bench", png: benchPng },
  { name: "electric_box", file: cp("Electric_Box_1") },
  { name: "hydrant", png: barrelPng },
  { name: "flower_bush", png: bushPng },
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

const objectPngs = OBJECTS.map((o) => ({ ...o, png: o.png ?? readPng(fixName(o.file!)) }));
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

const baseConcrete = ssTile(5, 1);
// Farm soil tiles (the urban pack has none) — warm earth, §2.1 palette.
// variant: bare soil / tilled (furrowed) / tilled_wet (watered = visibly darker).
function makeSoil(variant: "soil" | "tilled" | "tilled_wet"): PNG {
  const p = new PNG({ width: TILE, height: TILE });
  const base: [number, number, number] = variant === "tilled_wet" ? [74, 49, 34] : [110, 74, 52];
  const light: [number, number, number] = variant === "tilled_wet" ? [92, 62, 44] : [138, 94, 66];
  const dark: [number, number, number] = variant === "tilled_wet" ? [56, 36, 24] : [92, 60, 42];
  const hash = (x: number, y: number): number => {
    let v = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ (variant === "soil" ? 1 : 7)) >>> 0;
    v = (v ^ (v >>> 13)) >>> 0;
    return (v % 1000) / 1000;
  };
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const r = hash(x, y);
      const c = r < 0.12 ? dark : r > 0.9 ? light : base;
      setPx(p, x, y, [c[0], c[1], c[2], 255]);
    }
  }
  if (variant !== "soil") {
    const furrow: [number, number, number] = variant === "tilled_wet" ? [44, 29, 20] : [80, 52, 36];
    for (let y = 2; y < TILE; y += 5) {
      fillRect(p, 0, y, TILE, 1, [furrow[0], furrow[1], furrow[2], 255]);
    }
  }
  return p;
}

// Bitberry growth stages 0..4 (16x16, transparent). Natural greens + muted
// indigo berries — NOT a glowing tech accent (art bible: glow is sacred).
function makeBitberryStage(stage: number): PNG {
  const p = new PNG({ width: TILE, height: TILE });
  p.data.fill(0);
  const STEM: [number, number, number, number] = [62, 107, 67, 255];
  const LEAF: [number, number, number, number] = [111, 160, 90, 255];
  const BERRY: [number, number, number, number] = [86, 102, 150, 255];
  const BERRY_HI: [number, number, number, number] = [150, 165, 210, 255];
  const cx = 8;
  const h = [2, 4, 7, 10, 11][stage] ?? 2;
  const top = TILE - 2 - h;
  for (let y = TILE - 2; y >= top; y--) setPx(p, cx, y, STEM);
  if (stage >= 1) for (let y = TILE - 3; y >= top + 1; y -= 3) { setPx(p, cx - 1, y, LEAF); setPx(p, cx + 1, y, LEAF); }
  if (stage >= 2) for (let y = top; y <= top + (stage >= 3 ? 5 : 3); y++) { setPx(p, cx - 2, y, STEM); setPx(p, cx + 2, y, LEAF); }
  if (stage >= 3) fillRect(p, cx - 2, top - 1, 5, 3, LEAF);
  if (stage >= 4) {
    for (const [bx, by] of [[cx - 2, top + 1], [cx + 2, top], [cx, top - 1], [cx - 1, top + 3]] as const) {
      setPx(p, bx, by, BERRY);
      setPx(p, bx, by - 1, BERRY_HI);
    }
  }
  return p;
}

const synthObjects: Array<{ name: string; png: PNG }> = [
  { name: "concrete_b", png: makeWornConcrete(baseConcrete, 7) },
  { name: "concrete_c", png: makeWornConcrete(baseConcrete, 23) },
  { name: "crack_a", png: makeCrack(1, false) },
  { name: "crack_b", png: makeCrack(2, true) },
  { name: "soil", png: makeSoil("soil") },
  { name: "tilled", png: makeSoil("tilled") },
  { name: "tilled_wet", png: makeSoil("tilled_wet") },
];

/** Crop stage spritesheet (5 frames, 16x16). Not in the atlas, not shifted. */
function writeCropSheet(): void {
  const sheet = new PNG({ width: TILE * 5, height: TILE });
  sheet.data.fill(0);
  for (let s = 0; s < 5; s++) blit(sheet, makeBitberryStage(s), s * TILE, 0);
  const spriteDir = join(here, "../public/assets/sprites");
  mkdirSync(spriteDir, { recursive: true });
  writeFileSync(join(spriteDir, "crop_bitberry.png"), PNG.sync.write(sheet));
}

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

// ---- structures + gathering sprites -----------------------------------------
// Warm earthy palette (warm walls, mossy roofs, amber windows; tall buildings get
// a warm rooftop light). Each ships as its own spritesheet (NOT in the static
// atlas, NOT palette-shifted) so the client picks a frame by tier / depleted state.
const HP = {
  wall: [200, 160, 107, 255] as const,
  wallSh: [150, 120, 82, 255] as const,
  roof: [78, 122, 76, 255] as const,
  roofSh: [50, 86, 54, 255] as const,
  edge: [44, 34, 26, 255] as const,
  wood: [92, 74, 61, 255] as const,
  win: [26, 29, 36, 255] as const,
  winLit: [232, 179, 106, 255] as const,
  trunk: [92, 64, 44, 255] as const,
  trunkSh: [64, 44, 30, 255] as const,
  leaf: [86, 132, 72, 255] as const,
  leafSh: [54, 94, 52, 255] as const,
  leafHi: [126, 170, 100, 255] as const,
  stone: [140, 130, 118, 255] as const,
  stoneSh: [96, 88, 78, 255] as const,
  stoneHi: [184, 176, 162, 255] as const,
  ore: [110, 190, 168, 255] as const,
} as const;
type RGBA = readonly [number, number, number, number];
const c = (x: RGBA): [number, number, number, number] => [x[0], x[1], x[2], x[3]];

function outlineRect(p: PNG, x: number, y: number, w: number, h: number, col: RGBA): void {
  fillRect(p, x, y, w, 1, c(col));
  fillRect(p, x, y + h - 1, w, 1, c(col));
  fillRect(p, x, y, 1, h, c(col));
  fillRect(p, x + w - 1, y, 1, h, c(col));
}
/** Gable roof: rows widening from a narrow ridge down to `baseW`, centred on cx. */
function gable(p: PNG, cx: number, topY: number, baseW: number, rh: number): void {
  for (let i = 0; i < rh; i++) {
    const w = Math.max(2, Math.round((baseW * (i + 1)) / rh));
    const x0 = Math.round(cx - w / 2);
    fillRect(p, x0, topY + i, w, 1, c(i < rh / 3 ? HP.roof : HP.roofSh));
    setPx(p, x0, topY + i, c(HP.edge));
    setPx(p, x0 + w - 1, topY + i, c(HP.edge));
  }
  fillRect(p, Math.round(cx - baseW / 2), topY + rh - 1, baseW, 1, c(HP.edge)); // eave
}

// ---- P7: free-form structures (vertical chain + standalones) ----------------
// Extra palette beyond HP: browner wood walls + a warm beacon highlight for the
// tall-building crowns (ages theme — warm light, not cold tech).
const ST = {
  woodWall: [156, 107, 74, 255] as const, // #9C6B4A (art-bible "wood/structures")
  woodWallSh: [120, 82, 56, 255] as const,
  beaconHi: [255, 224, 160, 255] as const, // warm amber highlight
  // Warm tan for the tall synth tiers so they harmonise with the Sunnyside cottages.
  towerWall: [196, 154, 108, 255] as const,
  towerWallSh: [150, 112, 74, 255] as const,
} as const;

interface ChainParams {
  w: number;
  stories: number;
  storyH: number;
  roof: "peak" | "flat";
  wall: RGBA;
  wallSh: RGBA;
  crown: "none" | "chimney" | "green" | "beacon";
}
/** Frames 0..5 of the chain: hut → cabin → house → tower → high-rise → skyscraper.
 *  Footprint is a constant 2×2 (~32px); only HEIGHT grows — a player skyline. */
const CHAIN: ChainParams[] = [
  { w: 22, stories: 1, storyH: 18, roof: "peak", wall: ST.woodWall, wallSh: ST.woodWallSh, crown: "none" },
  { w: 26, stories: 1, storyH: 24, roof: "peak", wall: ST.woodWall, wallSh: ST.woodWallSh, crown: "chimney" },
  { w: 30, stories: 2, storyH: 18, roof: "peak", wall: HP.wall, wallSh: HP.wallSh, crown: "chimney" },
  { w: 26, stories: 4, storyH: 16, roof: "flat", wall: ST.towerWall, wallSh: ST.towerWallSh, crown: "none" },
  { w: 30, stories: 6, storyH: 14, roof: "flat", wall: ST.towerWall, wallSh: ST.towerWallSh, crown: "green" },
  { w: 32, stories: 8, storyH: 12, roof: "flat", wall: ST.towerWall, wallSh: ST.towerWallSh, crown: "beacon" },
];

function drawChain(p: PNG, cx: number, baseY: number, t: ChainParams): void {
  const bodyH = t.stories * t.storyH;
  const x0 = Math.round(cx - t.w / 2);
  const top = baseY - bodyH;
  fillRect(p, x0, top, t.w, bodyH, c(t.wall));
  fillRect(p, x0 + Math.round(t.w * 0.7), top, Math.round(t.w * 0.3), bodyH, c(t.wallSh)); // shade
  outlineRect(p, x0, top, t.w, bodyH, HP.edge);

  const cols = 2;
  const winW = Math.max(4, Math.round(t.w / (cols * 2.6)));
  const winH = Math.min(7, t.storyH - 5);
  const dw = Math.min(8, t.w - 8);
  const dx = Math.round(cx - dw / 2);
  const dh = Math.min(t.storyH - 2, 12);
  for (let s = 0; s < t.stories; s++) {
    const storyTop = baseY - (s + 1) * t.storyH;
    if (s > 0) fillRect(p, x0, baseY - s * t.storyH, t.w, 1, c(HP.edge)); // floor line
    for (let col = 0; col < cols; col++) {
      const wx = Math.round(x0 + ((col + 1) * t.w) / (cols + 1) - winW / 2);
      const wy = storyTop + Math.round((t.storyH - winH) / 2);
      if (s === 0 && wx < dx + dw && wx + winW > dx) continue; // door takes ground-centre
      const lit = (s + col) % 3 === 0; // ~⅓ lit, rest dead (the world mostly sleeps)
      fillRect(p, wx, wy, winW, winH, c(lit ? HP.winLit : HP.win));
      outlineRect(p, wx, wy, winW, winH, HP.edge);
    }
  }
  // door
  fillRect(p, dx, baseY - dh, dw, dh, c(HP.wood));
  outlineRect(p, dx, baseY - dh, dw, dh, HP.edge);
  setPx(p, dx + dw - 2, baseY - Math.round(dh / 2), c(HP.winLit));

  if (t.roof === "peak") {
    gable(p, cx, top - Math.round(t.w * 0.5), t.w + 8, Math.round(t.w * 0.5));
  } else {
    fillRect(p, x0 - 2, top - 3, t.w + 4, 3, c(t.wallSh)); // parapet
    outlineRect(p, x0 - 2, top - 3, t.w + 4, 3, HP.edge);
  }

  if (t.crown === "chimney") {
    const chX = x0 + Math.round(t.w * 0.7);
    fillRect(p, chX, top - 6, 5, 8, c(HP.wood));
    outlineRect(p, chX, top - 6, 5, 8, HP.edge);
  } else if (t.crown === "green") {
    // a warm rooftop light (modern building, ages theme)
    fillRect(p, cx - 3, top - 5, 6, 4, c(HP.winLit));
    setPx(p, cx - 2, top - 4, c(ST.beaconHi));
  } else if (t.crown === "beacon") {
    // antenna mast + a warm beacon light atop the skyscraper
    const mastTop = top - 14;
    fillRect(p, cx - 1, mastTop, 2, 14, c(HP.edge));
    fillRect(p, cx - 4, mastTop + 5, 9, 1, c(HP.edge)); // strut
    fillRect(p, cx - 3, mastTop - 3, 6, 4, c(HP.winLit));
    fillRect(p, cx - 1, mastTop - 5, 2, 3, c(ST.beaconHi));
  }
}

// ---- standalone props (frames 6..9) ----------------------------------------
function drawWallSeg(p: PNG, cx: number, baseY: number): void {
  const w = 14;
  const h = 10;
  const x0 = cx - w / 2;
  const top = baseY - h;
  fillRect(p, x0, top, w, h, c(HP.stone));
  fillRect(p, x0, top, w, 2, c(HP.stoneHi));
  fillRect(p, x0, baseY - 2, w, 2, c(HP.stoneSh));
  outlineRect(p, x0, top, w, h, HP.edge);
  fillRect(p, x0, top + 5, w, 1, c(HP.stoneSh)); // mortar
  for (const mx of [x0, x0 + 5, x0 + 10]) {
    fillRect(p, mx, top - 3, 4, 3, c(HP.stone));
    outlineRect(p, mx, top - 3, 4, 3, HP.edge);
  }
}
function drawGate(p: PNG, cx: number, baseY: number): void {
  const top = baseY - 20;
  for (const px of [cx - 7, cx + 4]) {
    fillRect(p, px, top, 3, 20, c(HP.wood));
    outlineRect(p, px, top, 3, 20, HP.edge);
  }
  fillRect(p, cx - 8, top, 16, 4, c(HP.wood));
  outlineRect(p, cx - 8, top, 16, 4, HP.edge);
  setPx(p, cx, top + 1, c(HP.winLit)); // keystone glint
}
function drawLamp(p: PNG, cx: number, baseY: number): void {
  fillRect(p, cx - 1, baseY - 22, 2, 22, c(HP.edge)); // post
  fillRect(p, cx - 3, baseY - 2, 6, 2, c(HP.stoneSh)); // base
  fillRect(p, cx - 3, baseY - 26, 6, 6, c(HP.wood)); // head
  outlineRect(p, cx - 3, baseY - 26, 6, 6, HP.edge);
  fillRect(p, cx - 2, baseY - 25, 4, 4, c(HP.winLit)); // bulb
  for (const [gx, gy] of [
    [cx - 4, baseY - 23],
    [cx + 3, baseY - 23],
    [cx, baseY - 28],
  ] as Array<[number, number]>) {
    setPx(p, gx, gy, [255, 183, 105, 90]); // faint warm halo
  }
}
/** Unclaimed-plot marker — a surveyor's stake + a small "for claim" sign. */
function drawStake(p: PNG, cx: number, baseY: number): void {
  fillRect(p, cx - 1, baseY - 18, 3, 18, c(HP.wood));
  outlineRect(p, cx - 1, baseY - 18, 3, 18, HP.edge);
  fillRect(p, cx - 9, baseY - 30, 20, 12, c(HP.wall));
  outlineRect(p, cx - 9, baseY - 30, 20, 12, HP.edge);
  fillRect(p, cx - 6, baseY - 26, 14, 1, c(HP.wood));
  fillRect(p, cx - 6, baseY - 23, 10, 1, c(HP.wood));
}

/** 9 frames, 64×112, bottom-anchored: 6 chain tiers + wall/gate/lamp.
 *  The client places by frame = StructureDef.frame, origin (0.5, 1). */
function writeStructuresSheet(): void {
  const CW = 64;
  const CH = 112;
  const standalones = [drawWallSeg, drawGate, drawLamp];
  const FRAMES = 6 + standalones.length;
  // Low tiers (hut/cabin/house) are Sunnyside cottages; tall tiers (tower/high-rise/
  // skyscraper) stay synthesized (the pack has no skyline), warm-toned to match.
  const HOUSES = [houseHutPng, houseCabinPng, houseHousePng];
  const sheet = new PNG({ width: CW * FRAMES, height: CH });
  sheet.data.fill(0);
  for (let i = 0; i < FRAMES; i++) {
    const f = new PNG({ width: CW, height: CH });
    f.data.fill(0);
    if (i < 3) {
      const h = HOUSES[i];
      PNG.bitblt(h, f, 0, 0, h.width, h.height, Math.round((CW - h.width) / 2), CH - 2 - h.height);
    } else if (i < 6) drawChain(f, CW / 2, CH - 2, CHAIN[i]);
    else standalones[i - 6](f, CW / 2, CH - 2);
    blit(sheet, f, i * CW, 0);
  }
  const spriteDir = join(here, "../public/assets/sprites");
  mkdirSync(spriteDir, { recursive: true });
  writeFileSync(join(spriteDir, "structures.png"), PNG.sync.write(sheet));
}

/** A single 32×48 stake for unclaimed plots. */
function writeStakeSprite(): void {
  const f = new PNG({ width: 32, height: 48 });
  f.data.fill(0);
  drawStake(f, 16, 46);
  const spriteDir = join(here, "../public/assets/sprites");
  mkdirSync(spriteDir, { recursive: true });
  writeFileSync(join(spriteDir, "plot_stake.png"), PNG.sync.write(f));
}

// gathering: tree | stump | rock | rubble, 32x48 each, anchored bottom-centre.
// The tree + rock are Sunnyside crops (see writeGatherSheet); the depleted
// stump + rubble stay synthesized.
function drawStump(p: PNG, x0: number): void {
  const cx = x0 + 16;
  fillRect(p, cx - 4, 38, 8, 8, c(HP.trunk));
  outlineRect(p, cx - 4, 38, 8, 8, HP.trunkSh);
  fillRect(p, cx - 4, 38, 8, 2, c(HP.leafSh)); // mossy cut top
  setPx(p, cx, 39, c(HP.trunkSh));
}
function drawRubble(p: PNG, x0: number): void {
  const cx = x0 + 16;
  fillRect(p, cx - 8, 42, 16, 4, c(HP.stoneSh));
  for (const [rx, ry, s] of [
    [cx - 6, 40, 3],
    [cx, 41, 4],
    [cx + 5, 40, 3],
  ] as Array<[number, number, number]>) {
    fillRect(p, rx, ry, s, s, c(HP.stone));
    outlineRect(p, rx, ry, s, s, HP.edge);
  }
}
function writeGatherSheet(): void {
  const CW = 32;
  const CH = 48;
  const sheet = new PNG({ width: CW * 4, height: CH });
  sheet.data.fill(0);
  blit(sheet, padBottomCenter(tightCrop(stripFrame(ssTree01, 32, 34, 0)), CW, CH), 0, 0);
  drawStump(sheet, CW);
  blit(sheet, padBottomCenter(rockPng, CW, CH), CW * 2, 0);
  drawRubble(sheet, CW * 3);
  const spriteDir = join(here, "../public/assets/sprites");
  mkdirSync(spriteDir, { recursive: true });
  writeFileSync(join(spriteDir, "gather.png"), PNG.sync.write(sheet));
}

// crack tiles are 1x1 -> treat as singles appended after the file singles
const synthSingles = synthObjects.filter((o) => o.png.width === TILE && o.png.height === TILE);
const synthMulti = synthObjects.filter((o) => !(o.png.width === TILE && o.png.height === TILE));

// Singles (file + synth 1x1) wrap across as many rows as needed; the collision
// marker and the multi-tile objects are placed below them.
const singleSources = [
  ...SINGLE_TILES.map((t) => ({ name: t.name, png: t.png ?? readPng(t.file!) })),
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
writeCropSheet();
writeStructuresSheet();
writeStakeSprite();
writeGatherSheet();

console.log(`atlas ${COLS * TILE}x${ROWS * TILE} (${COLS}x${ROWS} tiles)`);
console.log(`singles: ${singleSources.length}, objects: ${Object.keys(objectEntries).length}`);
console.log(`wrote sprites/{terminal,crop_bitberry,structures,plot_stake,gather}.png`);

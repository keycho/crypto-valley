/**
 * Palette-shift tool (art bible §2.1 / §9).
 *
 * Subtly remaps purchased LimeZu tile colours toward the "Overgrown Terminal"
 * warm base via a checked-in mapping table (mapping.json). It SHIFTS, it does
 * not repaint: each pixel is nudged by the delta of its nearest anchour colour,
 * with linear falloff over `radius`, so whole shading ramps move together and
 * sub-pixel detail survives.
 *
 * Applied at atlas-build time (apps/web/scripts/build-tileset.mts) — never baked
 * into the source archive under /assets-src.
 *
 * CLI sampler:  tsx tools/palette-shift/palette-shift.mts --sample <png> [topN]
 */
import { readFileSync } from "node:fs";
import { argv } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PNG } from "pngjs";

export interface ColorMapEntry {
  from: string;
  to: string;
  note?: string;
}

export interface PaletteMapping {
  /** Influence radius in RGB distance; larger = the shift reaches more colours. */
  radius: number;
  entries: ColorMapEntry[];
}

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const clamp = (n: number): number => (n < 0 ? 0 : n > 255 ? 255 : Math.round(n));

/** Mutates `png.data` in place, shifting colours toward the mapping's targets. */
export function applyPaletteShift(png: PNG, mapping: PaletteMapping): void {
  const anchors = mapping.entries.map((e) => ({
    from: hexToRgb(e.from),
    to: hexToRgb(e.to),
  }));
  const radius = mapping.radius;
  const data = png.data;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue; // transparent
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let best = -1;
    let bestDistSq = Infinity;
    for (let k = 0; k < anchors.length; k++) {
      const f = anchors[k].from;
      const d = (r - f[0]) ** 2 + (g - f[1]) ** 2 + (b - f[2]) ** 2;
      if (d < bestDistSq) {
        bestDistSq = d;
        best = k;
      }
    }
    if (best < 0) continue;
    const dist = Math.sqrt(bestDistSq);
    if (dist > radius) continue;

    const w = 1 - dist / radius; // subtle near the edge of influence
    const { from, to } = anchors[best];
    data[i] = clamp(r + (to[0] - from[0]) * w);
    data[i + 1] = clamp(g + (to[1] - from[1]) * w);
    data[i + 2] = clamp(b + (to[2] - from[2]) * w);
  }
}

/** Quantises and counts colours; used to author the mapping table from source art. */
export function sampleDominant(
  png: PNG,
  topN = 14,
): Array<{ hex: string; count: number }> {
  const counts = new Map<string, number>();
  const data = png.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const q = (v: number): number => Math.round(v / 16) * 16;
    const r = q(data[i]);
    const g = q(data[i + 1]);
    const b = q(data[i + 2]);
    const key = `${r},${g},${b}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key, count]) => {
      const [r, g, b] = key.split(",").map(Number);
      const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      return { hex, count };
    });
}

// ---- CLI sampler ------------------------------------------------------------
const isMain = import.meta.url === pathToFileURL(argv[1] ?? "").href;
if (isMain && argv[2] === "--sample") {
  const file = argv[3];
  if (!file) throw new Error("usage: --sample <png> [topN]");
  const png = PNG.sync.read(readFileSync(fileURLToPath(pathToFileURL(file))));
  const topN = argv[4] ? Number(argv[4]) : 14;
  for (const { hex, count } of sampleDominant(png, topN)) {
    console.log(`${hex}  ${count}`);
  }
}

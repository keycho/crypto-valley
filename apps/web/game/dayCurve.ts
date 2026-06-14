/**
 * Lighting CONTENT CONFIG (art bible §3) — not engine constants.
 *
 * The ambient day curve and the per-kind light registry live here so they can be
 * tuned without touching scene code.
 */

/** Ambient tint keyframes across the 24h clock (minute-of-day -> hex). */
export interface AmbientKey {
  minute: number;
  color: number;
}

// Warm Ages curve (art-bible §4): dawn #FFD9A0 -> noon #FBF1DA (warm near-neutral)
// -> golden hour #FFDCA0 -> dusk #FF9E6B (hero) -> warm violet -> night. Daylight
// leans golden; dusk is rich. Depth pass: the dark keys sit slightly below the
// bible night anchor so lit vs shadowed forms separate sharply and lamps pop.
export const AMBIENT_CURVE: AmbientKey[] = [
  { minute: 0, color: 0x242038 }, // deep night (contrast-stretched #2B2A40)
  { minute: 285, color: 0x242038 }, // 04:45 still night
  { minute: 360, color: 0xffd9a0 }, // 06:00 dawn
  { minute: 450, color: 0xffe7c0 }, // 07:30 warm morning
  { minute: 720, color: 0xfbf1da }, // 12:00 noon (warm near-neutral, §4)
  { minute: 990, color: 0xffdca0 }, // 16:30 golden hour (rich warm gold)
  { minute: 1110, color: 0xff9e6b }, // 18:30 dusk (hero window)
  { minute: 1185, color: 0x7c4258 }, // 19:45 deep dusk -> rich warm violet
  { minute: 1275, color: 0x282340 }, // 21:15 night settling
  { minute: 1440, color: 0x242038 }, // wrap
];

export type LightKind = "window" | "lamp" | "terminal";

export interface LightDef {
  /** Light colour (warm sources #FFB769-ish; the terminal is terminal-green). */
  color: number;
  /** Radius in pixels. */
  radius: number;
  /** Peak intensity. */
  intensity: number;
  /** Warm sources fade in after dusk; the terminal (living tech) is always lit. */
  warm: boolean;
}

// Warm point lights (art-bible §4.3): amber #FFB769, radius 3-5 tiles, gentle
// flicker. Cozy pools that read clearly by the dusk hero window.
export const LIGHT_REGISTRY: Record<LightKind, LightDef> = {
  window: { color: 0xffb769, radius: 64, intensity: 1.5, warm: true },
  lamp: { color: 0xffb769, radius: 76, intensity: 1.7, warm: true },
  terminal: { color: 0x34d399, radius: 64, intensity: 1.2, warm: false },
};

const lerpChannel = (a: number, b: number, t: number): number => Math.round(a + (b - a) * t);

export function ambientColorAt(minute: number): number {
  const m = ((minute % 1440) + 1440) % 1440;
  const keys = AMBIENT_CURVE;
  let lo = keys[0];
  let hi = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (m >= keys[i].minute && m <= keys[i + 1].minute) {
      lo = keys[i];
      hi = keys[i + 1];
      break;
    }
  }
  const span = hi.minute - lo.minute || 1;
  const t = (m - lo.minute) / span;
  const r = lerpChannel((lo.color >> 16) & 0xff, (hi.color >> 16) & 0xff, t);
  const g = lerpChannel((lo.color >> 8) & 0xff, (hi.color >> 8) & 0xff, t);
  const b = lerpChannel(lo.color & 0xff, hi.color & 0xff, t);
  return (r << 16) | (g << 8) | b;
}

/**
 * 0 at full day, 1 at deep night — drives how strongly warm lights glow. Tracks
 * the ambient BLUE channel rather than luma: warm dusk keeps a high red, so a
 * luma measure barely registers it, but blue drops steadily from day into night.
 * This lets lamp pools come up cozily by the dusk hero window (#FF9E6B, blue 107
 * -> ~0.73) while staying dark in daylight (#FBF1DA, blue 218 -> ~0.10).
 */
export function nightnessAt(minute: number): number {
  const blue = ambientColorAt(minute) & 0xff;
  return Math.max(0, Math.min(1, (235 - blue) / 175));
}

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

// dawn #FFD9A0 -> noon #FFF7EA (near-neutral) -> dusk #FF9E6B -> night #2B2640.
// Depth pass: the dark keys sit slightly below the bible anchors so lit vs
// shadowed forms separate more sharply; hues unchanged.
export const AMBIENT_CURVE: AmbientKey[] = [
  { minute: 0, color: 0x242038 }, // deep night (contrast-stretched #2B2640)
  { minute: 270, color: 0x242038 }, // 04:30 still night
  { minute: 360, color: 0xffd9a0 }, // 06:00 dawn
  { minute: 480, color: 0xffeccb }, // 08:00 morning
  { minute: 720, color: 0xfff7ea }, // 12:00 noon
  { minute: 1020, color: 0xffe2b4 }, // 17:00 golden
  { minute: 1110, color: 0xff9e6b }, // 18:30 dusk (hero window)
  { minute: 1200, color: 0x6e4a5e }, // 20:00 dusk -> violet (deepened)
  { minute: 1290, color: 0x242038 }, // 21:30 night
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

export const LIGHT_REGISTRY: Record<LightKind, LightDef> = {
  window: { color: 0xffb769, radius: 60, intensity: 1.4, warm: true },
  lamp: { color: 0xffd9a0, radius: 72, intensity: 1.7, warm: true },
  terminal: { color: 0x34d399, radius: 64, intensity: 1.3, warm: false },
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

/** 0 at full day, 1 at deep night — drives how strongly warm lights glow. */
export function nightnessAt(minute: number): number {
  const c = ambientColorAt(minute);
  const luma = (((c >> 16) & 0xff) + ((c >> 8) & 0xff) + (c & 0xff)) / 3;
  // ~ #2B2640 luma 48 -> 1 ; >= ~200 -> 0
  return Math.max(0, Math.min(1, (200 - luma) / 150));
}

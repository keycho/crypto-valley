/**
 * Energy — PURE, lazily computed from a timestamp (no per-tick regen).
 * Appendix A: max 100, regen 1 per 36s.
 */
export const ENERGY_MAX = 100;
export const ENERGY_REGEN_MS = 36_000;

/** Action energy costs (art doc §5.1 / appendix A). */
export const ACTION_ENERGY: Record<string, number> = {
  hoe: 2,
  water: 1,
  plant: 1,
  harvest: 1,
};

/** Current energy given a stored value last updated at `updatedAt`. */
export function regenEnergy(
  stored: number,
  updatedAt: number,
  now: number,
  regenMs = ENERGY_REGEN_MS,
  max = ENERGY_MAX,
): number {
  if (now <= updatedAt) return Math.min(max, stored);
  const gained = Math.floor((now - updatedAt) / regenMs);
  return Math.min(max, stored + gained);
}

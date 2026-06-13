/**
 * Crop growth — PURE and deterministic (no IO, no Date.now()). Growth accrues
 * ONLY while a crop is watered (art doc §5.2); time is always passed in.
 *
 * Schema-fit model (packages/db `crops`): a crop has `plantedAt`, a
 * `wateredUntil` timestamp, and `growthCreditMs` (watered-time banked before the
 * current watering window). The current window started at `wateredUntil -
 * waterMs`, so growth is computable from those three columns alone — no extra
 * "last credited at" column, no per-tile ticking.
 */
export interface CropDef {
  /** Number of growth steps; the crop is harvestable at `stage === stages`. */
  stages: number;
  /** Real milliseconds of watered time per stage (the server derives this from
   *  content seconds-per-stage scaled by the clock speed). */
  msPerStage: number;
  /** Season indices (0..3) the crop survives in; out of season it withers. */
  seasons: number[];
}

export interface CropState {
  plantedAt: number;
  /** Epoch ms the current watering lasts until, or null if never watered. */
  wateredUntil: number | null;
  growthCreditMs: number;
}

export interface CropView {
  stage: number;
  ready: boolean;
  dead: boolean;
  /** Total watered ms accrued at `now` (handy for UI/debug). */
  creditMs: number;
}

/** Watered ms accrued in the current window, up to `at`. */
function activeCredit(state: CropState, at: number, waterMs: number): number {
  if (state.wateredUntil === null) return 0;
  const windowStart = state.wateredUntil - waterMs;
  return Math.max(0, Math.min(at, state.wateredUntil) - windowStart);
}

/** Total banked credit if we were to settle the current window at `at`. */
export function bankGrowth(state: CropState, at: number, waterMs: number): number {
  return state.growthCreditMs + activeCredit(state, at, waterMs);
}

/** Growth stage / readiness / death of a crop at time `now` in `season`. */
export function cropStage(
  state: CropState,
  def: CropDef,
  now: number,
  season: number,
  waterMs: number,
): CropView {
  const creditMs = state.growthCreditMs + activeCredit(state, now, waterMs);
  const stage = Math.min(def.stages, Math.floor(creditMs / def.msPerStage));
  const dead = !def.seasons.includes(season) && stage < def.stages;
  return { stage, ready: stage >= def.stages, dead, creditMs };
}

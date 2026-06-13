/**
 * Crop catalog (GAME DATA AS CODE). Timing is clock-agnostic (`secondsPerStage`
 * at the normal day rate); the server scales it by the active clock speed and
 * hands packages/sim a ready `msPerStage`. Real seasonal tuning lands later;
 * for the P3 farming core, bitberry is all-season so the loop is demonstrable.
 */
export interface CropContent {
  /** Crop item id (also the produce item id). */
  id: string;
  /** Seed item id that plants this crop. */
  seed: string;
  /** Produce item id and amount granted on harvest. */
  produce: string;
  produceQty: number;
  /** Growth steps; harvestable at the final stage. */
  stages: number;
  /** Watered seconds per stage at the normal clock rate. */
  secondsPerStage: number;
  /** Season indices (0..3) the crop survives in. */
  seasons: number[];
  /** Farming XP granted on harvest. */
  xp: number;
}

export const CROPS: Record<string, CropContent> = {
  crop_bitberry: {
    id: "crop_bitberry",
    seed: "seed_bitberry",
    produce: "crop_bitberry",
    produceQty: 2,
    stages: 4,
    secondsPerStage: 90,
    seasons: [0, 1, 2, 3],
    xp: 12,
  },
};

/** seed item id -> crop id. */
export const SEED_TO_CROP: Record<string, string> = Object.fromEntries(
  Object.values(CROPS).map((c) => [c.seed, c.id]),
);

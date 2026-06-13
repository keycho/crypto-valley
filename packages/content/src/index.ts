/**
 * packages/content — GAME DATA AS CODE.
 *
 * Static catalogs (items, crops, recipes, NPC dialogue trees, quests, seasons)
 * live here and are validated in CI (see `validate.ts`). More data lands
 * alongside each system.
 */
export * from "./items";

/** Bumped when content schemas change, so caches can be invalidated. */
export const CONTENT_VERSION = "0.0.0" as const;

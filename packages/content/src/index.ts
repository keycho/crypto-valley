/**
 * packages/content — GAME DATA AS CODE.
 *
 * Static catalogs (items, crops, recipes, NPC dialogue trees, quests, seasons)
 * live here and are validated in CI. Real data lands alongside each system.
 */

/** Bumped when content schemas change, so caches can be invalidated. */
export const CONTENT_VERSION = "0.0.0" as const;

/**
 * packages/sim — PURE deterministic gameplay logic.
 *
 * Rules (see CLAUDE.md): no IO, no `Date.now()`. Time is always passed in as a
 * parameter, so `same seed + inputs => same outputs`, always. The API, the game
 * server, and the client all import this package, so determinism is sacred.
 *
 * Real systems (crops, energy, crafting, movement) land in M1+.
 */

/** Placeholder pure helper, replaced by real sim logic later. */
export function add(a: number, b: number): number {
  return a + b;
}

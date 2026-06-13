/**
 * packages/sim — PURE deterministic gameplay logic.
 *
 * Rules (CLAUDE.md): no IO, no `Date.now()`. Time is always a parameter, so
 * `same inputs => same outputs`, always. The API, the game server, and the
 * client all import this package; determinism is sacred. Tests are required.
 */
export * from "./crops";
export * from "./energy";

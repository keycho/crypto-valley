/**
 * packages/worldgen — PURE deterministic world generation.
 *
 * Rules (see CLAUDE.md): no IO, no `Date.now()`. Generation is a pure function of
 * the seed and inputs, so the dev sandbox and the live game can never drift. The
 * real noise/biome/region/landmark modules are ported from the worldgen sandbox
 * (docs/crypto-valley-procedural-world.md) in a later milestone.
 */

/**
 * Placeholder deterministic 32-bit string hash (xmur3-style mix). Stands in for
 * the real seeded RNG so the determinism contract already has a test to defend.
 */
export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

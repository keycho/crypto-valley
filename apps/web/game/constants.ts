/**
 * Art constants. CLAUDE.md locks 16px tiles / pixel-perfect rendering; the P2.5
 * review wants ~25-30 tiles visible across the window, so zoom is computed per
 * viewport as an INTEGER (crisp pixels) targeting TARGET_TILES_ACROSS.
 */
export const TILE_SIZE = 16;
export const TARGET_TILES_ACROSS = 28;
export const MIN_ZOOM = 3;

/** Integer camera zoom for a given canvas width (1440px -> 3x = 30 tiles). */
export function zoomFor(viewportWidth: number): number {
  return Math.max(MIN_ZOOM, Math.round(viewportWidth / (TARGET_TILES_ACROSS * TILE_SIZE)));
}

/** Player walk speed in px/s. */
export const PLAYER_SPEED = 90;

/**
 * Fake in-game clock. Default: 1 game-minute per real second (a 24-min day).
 * Set NEXT_PUBLIC_FAST_CLOCK=1 in dev for a full day every 3 minutes so the
 * day/night cycle is easy to review.
 */
export const FAST_CLOCK = process.env.NEXT_PUBLIC_FAST_CLOCK === "1";
export const GAME_MINUTE_MS = FAST_CLOCK ? 1000 / 8 : 1000;
/** The clock starts at 08:00. */
export const CLOCK_START_MINUTES = 8 * 60;

/** Static "above" layer (roofs/canopies) always renders over y-sorted actors. */
export const DEPTH_ABOVE = 1_000_000;

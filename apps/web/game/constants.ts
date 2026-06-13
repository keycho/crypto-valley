/**
 * Art constants. CLAUDE.md locks 16px tiles / pixel-perfect; the founder's P2.5
 * review raised the zoom so ~25-30 tiles span a 1440px window (city feel). 3.5x
 * keeps tile edges on whole pixels (3.5 * 16 = 56) so it stays crisp.
 */
export const TILE_SIZE = 16;
export const ZOOM = 3.5;

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

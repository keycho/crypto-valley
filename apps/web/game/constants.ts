/** Locked art constants (CLAUDE.md): 16px tiles, 3x zoom, pixel-perfect. */
export const TILE_SIZE = 16;
export const ZOOM = 3;

/** Player walk speed in px/s. */
export const PLAYER_SPEED = 90;

/** Fake in-game clock: 1 game minute per real second. */
export const GAME_MINUTE_MS = 1000;
/** The clock starts at 08:00. */
export const CLOCK_START_MINUTES = 8 * 60;

/** Render depths: ground 0 / ground_detail 1 / player 5 / above 10. */
export const DEPTH_PLAYER = 5;
export const DEPTH_ABOVE = 10;

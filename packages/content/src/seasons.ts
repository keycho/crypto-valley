/**
 * Seasons + leaderboard config — GAME DATA AS CODE (P10, the competition layer).
 *
 * Time-boxed seasons rank players on two boards: PROFIT (flip P&L during the
 * season) and PORTFOLIO VALUE (worth of land currently owned). At season end the
 * prize pool — the market fees accrued that season (fee-funded, NEVER emissions;
 * see docs/token-addendum.md) — is split among the top finishers. A reset only
 * zeroes the scoreboard; assets (land/buildings/Shards/items) are permanent.
 */

/** Default season length (one week). Tunable; the API may override via env for tests. */
export const SEASON_LENGTH_MS = 7 * 24 * 60 * 60 * 1000;

/** Base portfolio value of owning a plot (before its structures). */
export const PLOT_BASE_VALUE = 100;

/** How many ranked players each board returns for display. */
export const LEADERBOARD_TOP_N = 10;

/** Prizes are paid to the top N finishers of each board. */
export const PRIZE_RANKS = 3;

/** Pool split between the two boards (PROFIT is the headline). Sums to 1. */
export const PROFIT_POOL_SHARE = 0.7;
export const PORTFOLIO_POOL_SHARE = 0.3;

/** Within a board, how the board's slice splits across ranks 1/2/3. Sums to 1. */
export const RANK_SPLIT = [0.5, 0.3, 0.2] as const;

export type Board = "profit" | "portfolio";

/**
 * PURE: prize amounts (floored Shards) for ranks 1..PRIZE_RANKS of each board,
 * given the season pool. Sum of all prizes ≤ pool (flooring leaves a few in the
 * treasury) — payouts can never exceed the fee-funded pool.
 */
export function computePrizes(pool: number): { profit: number[]; portfolio: number[] } {
  const slice = (share: number): number[] => {
    const boardPool = Math.floor(pool * share);
    return RANK_SPLIT.map((s) => Math.floor(boardPool * s));
  };
  return { profit: slice(PROFIT_POOL_SHARE), portfolio: slice(PORTFOLIO_POOL_SHARE) };
}

/** A character's permanent trophy title from a recorded season result. */
export function trophyTitle(seasonNumber: number, board: Board, rank: number): string {
  if (board === "profit" && rank === 1) return `Season ${seasonNumber} Champion`;
  if (board === "portfolio" && rank === 1) return `Season ${seasonNumber} Top Builder`;
  const medal = rank === 2 ? "Silver" : rank === 3 ? "Bronze" : `#${rank}`;
  return `Season ${seasonNumber} ${board === "profit" ? "Flipper" : "Builder"} ${medal}`;
}

/**
 * Land-market config — GAME DATA AS CODE (P9, the flip economy).
 *
 * Player-to-player land resale: owners list plots at a price they set, buyers
 * pay in Shards, a small fee accrues to the house treasury (funds season prize
 * pools later). Currency is "shards" for now but carried through everywhere so
 * the native token can swap in post-legal-review.
 */

/** Max plots a single player may own (portfolio cap — claims/buys past this fail). */
export const MAX_PLOTS = 8;

/** Default market currency until the token swaps in. */
export const MARKET_CURRENCY = "shards" as const;

/** Market fee on a sale, in basis points (500 = 5%). Cut goes to the treasury. */
export const MARKET_FEE_BPS = 500;

/** Fee charged on a sale at `price` (floored), and what the seller nets. */
export function marketFee(price: number): number {
  return Math.floor((price * MARKET_FEE_BPS) / 10_000);
}
export function sellerProceeds(price: number): number {
  return price - marketFee(price);
}

/** Sane bounds for a listing price (Shards). */
export const MIN_LISTING_PRICE = 1;
export const MAX_LISTING_PRICE = 1_000_000_000;

import { and, eq, sql } from "drizzle-orm";

import type { Tx } from "../client";
import { TypedError } from "../errors";
import { listings, plots, treasury } from "../schema";
import { moveShards } from "./moveShards";
import { ownedPlotCount } from "./plots";

export interface BuyResult {
  plotIndex: number;
  price: number;
  fee: number;
  currency: string;
  sellerId: string;
}

/** Look up + lock a plot by content index. */
async function lockPlot(tx: Tx, plotIndex: number) {
  const [plot] = await tx
    .select()
    .from(plots)
    .where(eq(plots.plotIndex, plotIndex))
    .for("update");
  if (!plot) throw new TypedError("PLOT_NOT_FOUND", `no plot #${plotIndex}`);
  return plot;
}

/**
 * List one of your owned plots for sale at `price` (or re-price an existing
 * listing). The plot row is locked so listing races serialize. Listing does NOT
 * lock you out of using the plot.
 *
 * @throws TypedError `PLOT_NOT_FOUND` | `NOT_PLOT_OWNER` | `BAD_PRICE`
 */
export async function listPlot(
  tx: Tx,
  characterId: string,
  plotIndex: number,
  price: number,
  currency: string,
): Promise<void> {
  if (!Number.isInteger(price) || price <= 0) throw new TypedError("BAD_PRICE", "price must be > 0");
  const plot = await lockPlot(tx, plotIndex);
  if (plot.ownerId !== characterId) throw new TypedError("NOT_PLOT_OWNER", "not your plot");

  const [existing] = await tx
    .select()
    .from(listings)
    .where(and(eq(listings.plotId, plot.id), eq(listings.status, "active")));
  if (existing) {
    await tx
      .update(listings)
      .set({ price, currency, sellerId: characterId })
      .where(eq(listings.id, existing.id));
  } else {
    await tx.insert(listings).values({ plotId: plot.id, sellerId: characterId, price, currency });
  }
}

/**
 * Cancel your own active listing on a plot.
 * @throws TypedError `PLOT_NOT_FOUND` | `NOT_LISTED` | `NOT_PLOT_OWNER`
 */
export async function unlistPlot(tx: Tx, characterId: string, plotIndex: number): Promise<void> {
  const plot = await lockPlot(tx, plotIndex);
  const [listing] = await tx
    .select()
    .from(listings)
    .where(and(eq(listings.plotId, plot.id), eq(listings.status, "active")))
    .for("update");
  if (!listing) throw new TypedError("NOT_LISTED", "plot is not listed");
  if (listing.sellerId !== characterId) throw new TypedError("NOT_PLOT_OWNER", "not your listing");
  await tx.update(listings).set({ status: "cancelled" }).where(eq(listings.id, listing.id));
}

/**
 * Buy a listed plot — server-authoritative, dupe-proof, ledgered:
 *
 *  - locks the plot's ACTIVE listing by the `status='active'` predicate, so two
 *    concurrent buyers can't both win (the loser re-reads the now-sold row, which
 *    fails the predicate → `NOT_LISTED`);
 *  - blocks buying your own listing and exceeding the portfolio cap;
 *  - transfers Shards buyer→seller via `moveShards` (ledgered) and accrues the fee
 *    cut to the treasury; transfers ownership (structures STAY — they reference the
 *    plot); marks the listing sold. All in one transaction.
 *
 * @throws TypedError `PLOT_NOT_FOUND` | `NOT_LISTED` | `CANT_BUY_OWN` |
 *                    `PLOT_CAP_REACHED` | `INSUFFICIENT_FUNDS`
 */
export async function buyPlot(
  tx: Tx,
  buyerId: string,
  plotIndex: number,
  maxPlots: number,
  feeBps: number,
  at: Date,
): Promise<BuyResult> {
  const plot = await lockPlot(tx, plotIndex);

  // Lock the active listing by predicate — THIS is the race serialization point.
  const [listing] = await tx
    .select()
    .from(listings)
    .where(and(eq(listings.plotId, plot.id), eq(listings.status, "active")))
    .for("update");
  if (!listing) throw new TypedError("NOT_LISTED", "plot is not listed");
  if (listing.sellerId === buyerId) throw new TypedError("CANT_BUY_OWN", "cannot buy your own plot");
  if ((await ownedPlotCount(tx, buyerId)) >= maxPlots) {
    throw new TypedError("PLOT_CAP_REACHED", `cannot own more than ${maxPlots} plots`);
  }
  // Ownership must still match the listing (defensive against a stale listing).
  if (plot.ownerId !== listing.sellerId) {
    await tx.update(listings).set({ status: "cancelled" }).where(eq(listings.id, listing.id));
    throw new TypedError("NOT_LISTED", "listing is stale");
  }

  const price = listing.price;
  const currency = listing.currency;
  const fee = Math.floor((price * feeBps) / 10_000);
  const proceeds = price - fee;

  // Currency-agnostic seam: Shards today; route to moveTokens when the token lands.
  await moveShards(tx, buyerId, -price, "land_buy", listing.id);
  await moveShards(tx, listing.sellerId, proceeds, "land_sale", listing.id);
  if (fee > 0) {
    await tx
      .insert(treasury)
      .values({ currency, balance: fee })
      .onConflictDoUpdate({
        target: treasury.currency,
        set: { balance: sql`${treasury.balance} + ${fee}` },
      });
  }

  await tx.update(plots).set({ ownerId: buyerId, claimedAt: at }).where(eq(plots.id, plot.id));
  await tx
    .update(listings)
    .set({ status: "sold", soldTo: buyerId, soldAt: at })
    .where(eq(listings.id, listing.id));

  return { plotIndex, price, fee, currency, sellerId: listing.sellerId };
}

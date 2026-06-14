import { and, eq, isNotNull, sql } from "drizzle-orm";

import type { Tx } from "../client";
import { TypedError } from "../errors";
import { plots } from "../schema";
import { moveShards } from "./moveShards";

export interface PlotRow {
  id: string;
  plotIndex: number;
  ownerId: string | null;
}

/**
 * Claim an unclaimed plot for a player, server-authoritatively and dupe-proof:
 *
 *  - locks the target plot row (`FOR UPDATE`) so two simultaneous claims of the
 *    same plot serialize — the loser sees it already TAKEN;
 *  - enforces ONE plot per player (a DB partial-unique index backs this up);
 *  - charges the Shards fee through `moveShards`, which writes the ledger row in
 *    THIS transaction (throws `INSUFFICIENT_FUNDS` if short — rolls everything
 *    back).
 *
 * @throws TypedError `PLOT_NOT_FOUND` | `PLOT_TAKEN` | `ALREADY_OWN_PLOT` | `INSUFFICIENT_FUNDS`
 */
export async function claimPlot(
  tx: Tx,
  characterId: string,
  plotIndex: number,
  feeShards: number,
  at: Date,
): Promise<PlotRow> {
  const [plot] = await tx
    .select()
    .from(plots)
    .where(eq(plots.plotIndex, plotIndex))
    .for("update");
  if (!plot) throw new TypedError("PLOT_NOT_FOUND", `no plot #${plotIndex}`);
  if (plot.ownerId) throw new TypedError("PLOT_TAKEN", `plot #${plotIndex} is owned`);

  // One plot per player at MVP (the partial-unique index is the hard guarantee;
  // this gives a clean error before we try to write).
  const [{ owned }] = await tx
    .select({ owned: sql<number>`count(*)::int` })
    .from(plots)
    .where(eq(plots.ownerId, characterId));
  if (owned > 0) throw new TypedError("ALREADY_OWN_PLOT", "player already owns a plot");

  await moveShards(tx, characterId, -feeShards, "plot_claim", plot.id);

  await tx
    .update(plots)
    .set({ ownerId: characterId, claimedAt: at })
    .where(eq(plots.id, plot.id));

  return { id: plot.id, plotIndex: plot.plotIndex, ownerId: characterId };
}

/** A convenience the API uses for the "you already own a plot?" guard. */
export async function ownedPlotIndex(tx: Tx, characterId: string): Promise<number | null> {
  const [row] = await tx
    .select({ plotIndex: plots.plotIndex })
    .from(plots)
    .where(and(eq(plots.ownerId, characterId), isNotNull(plots.ownerId)));
  return row?.plotIndex ?? null;
}

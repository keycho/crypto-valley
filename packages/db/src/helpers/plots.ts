import { eq, sql } from "drizzle-orm";

import type { Tx } from "../client";
import { TypedError } from "../errors";
import { plots } from "../schema";
import { moveShards } from "./moveShards";

export interface PlotRow {
  id: string;
  plotIndex: number;
  ownerId: string | null;
}

/** How many plots a character currently owns. */
export async function ownedPlotCount(tx: Tx, characterId: string): Promise<number> {
  const [{ n }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(plots)
    .where(eq(plots.ownerId, characterId));
  return n;
}

/**
 * Claim an unclaimed plot for a player, server-authoritatively and dupe-proof:
 *
 *  - locks the target plot row (`FOR UPDATE`) so two simultaneous claims of the
 *    same plot serialize — the loser sees it already TAKEN;
 *  - enforces the portfolio cap (`maxPlots`) — players may own several plots (P9);
 *  - charges the Shards fee through `moveShards`, which writes the ledger row in
 *    THIS transaction (throws `INSUFFICIENT_FUNDS` if short — rolls everything
 *    back).
 *
 * @throws TypedError `PLOT_NOT_FOUND` | `PLOT_TAKEN` | `PLOT_CAP_REACHED` | `INSUFFICIENT_FUNDS`
 */
export async function claimPlot(
  tx: Tx,
  characterId: string,
  plotIndex: number,
  feeShards: number,
  maxPlots: number,
  at: Date,
): Promise<PlotRow> {
  const [plot] = await tx
    .select()
    .from(plots)
    .where(eq(plots.plotIndex, plotIndex))
    .for("update");
  if (!plot) throw new TypedError("PLOT_NOT_FOUND", `no plot #${plotIndex}`);
  if (plot.ownerId) throw new TypedError("PLOT_TAKEN", `plot #${plotIndex} is owned`);

  if ((await ownedPlotCount(tx, characterId)) >= maxPlots) {
    throw new TypedError("PLOT_CAP_REACHED", `cannot own more than ${maxPlots} plots`);
  }

  await moveShards(tx, characterId, -feeShards, "plot_claim", plot.id);

  await tx
    .update(plots)
    .set({ ownerId: characterId, claimedAt: at })
    .where(eq(plots.id, plot.id));

  return { id: plot.id, plotIndex: plot.plotIndex, ownerId: characterId };
}

/** The plot indices a character owns (sorted) — for the player's portfolio view. */
export async function ownedPlotIndexes(tx: Tx, characterId: string): Promise<number[]> {
  const rows = await tx
    .select({ plotIndex: plots.plotIndex })
    .from(plots)
    .where(eq(plots.ownerId, characterId));
  return rows.map((r) => r.plotIndex).sort((a, b) => a - b);
}

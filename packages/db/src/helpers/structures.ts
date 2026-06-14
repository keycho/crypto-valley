import { eq } from "drizzle-orm";

import type { Tx } from "../client";
import { TypedError } from "../errors";
import { plots, structures } from "../schema";
import { moveItems } from "./moveItems";
import { moveShards } from "./moveShards";

export interface StructureCost {
  wood: number;
  stone: number;
  shards: number;
}

export interface StructureRow {
  id: string;
  plotIndex: number;
  defId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  tier: number;
}

/** Axis-aligned footprint overlap (half-open tile rects). */
function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
}

/**
 * Place a structure on the caller's OWNED plot — server-authoritative + dupe-proof.
 *
 *  - locks the player's plot row (`FOR UPDATE`) so two simultaneous placements
 *    serialize and the overlap check is consistent;
 *  - validates the footprint is fully inside the plot and overlaps no existing
 *    structure;
 *  - consumes wood/stone (`moveItems`) + Shards (`moveShards`, ledgered) in THIS
 *    transaction — any shortfall throws and rolls everything back (no dupes).
 *
 * @throws TypedError `NO_PLOT` | `OUT_OF_BOUNDS` | `OVERLAP` |
 *                    `INSUFFICIENT_ITEMS` | `INSUFFICIENT_FUNDS`
 */
export async function placeStructure(
  tx: Tx,
  characterId: string,
  params: {
    plotIndex: number;
    defId: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotation: number;
    tier: number;
    cost: StructureCost;
  },
): Promise<StructureRow> {
  const { plotIndex, defId, x, y, w, h, rotation, tier, cost } = params;

  // Build on a SPECIFIC plot (players may own several, P9); lock it + verify owner.
  const [plot] = await tx
    .select()
    .from(plots)
    .where(eq(plots.plotIndex, plotIndex))
    .for("update");
  if (!plot) throw new TypedError("NO_PLOT", "no such plot");
  if (plot.ownerId !== characterId) throw new TypedError("NOT_PLOT_OWNER", "not your plot");

  if (x < plot.x || y < plot.y || x + w > plot.x + plot.w || y + h > plot.y + plot.h) {
    throw new TypedError("OUT_OF_BOUNDS", "structure must sit inside your plot");
  }

  const existing = await tx
    .select({ x: structures.x, y: structures.y, w: structures.w, h: structures.h })
    .from(structures)
    .where(eq(structures.plotId, plot.id));
  for (const s of existing) {
    if (rectsOverlap(x, y, w, h, s.x, s.y, s.w, s.h)) {
      throw new TypedError("OVERLAP", "overlaps an existing structure");
    }
  }

  await moveItems(tx, [
    { characterId, itemId: "wood", qty: -cost.wood },
    { characterId, itemId: "stone", qty: -cost.stone },
  ]);
  await moveShards(tx, characterId, -cost.shards, "structure_place", plot.id);

  const [row] = await tx
    .insert(structures)
    .values({ plotId: plot.id, defId, x, y, w, h, rotation, level: tier })
    .returning({ id: structures.id });

  return { id: row.id, plotIndex: plot.plotIndex, defId, x, y, w, h, rotation, tier };
}

/**
 * Upgrade an owned structure in place to its next chain tier. The structure row
 * is locked and its current `def_id` is compared to `fromDefId` (optimistic
 * concurrency) so a racing upgrade can't double-charge. Footprint is unchanged
 * (the chain grows only vertically), so no re-validation of bounds/overlap.
 *
 * @throws TypedError `STRUCTURE_NOT_FOUND` | `NOT_PLOT_OWNER` | `STRUCTURE_STALE`
 *                    | `INSUFFICIENT_ITEMS` | `INSUFFICIENT_FUNDS`
 */
export async function upgradeStructure(
  tx: Tx,
  characterId: string,
  structureId: string,
  params: { fromDefId: string; toDefId: string; toTier: number; cost: StructureCost },
): Promise<StructureRow> {
  const [s] = await tx
    .select()
    .from(structures)
    .where(eq(structures.id, structureId))
    .for("update");
  if (!s || !s.plotId) throw new TypedError("STRUCTURE_NOT_FOUND", "no such structure");

  const [plot] = await tx.select().from(plots).where(eq(plots.id, s.plotId));
  if (!plot || plot.ownerId !== characterId) {
    throw new TypedError("NOT_PLOT_OWNER", "not your structure");
  }
  if (s.defId !== params.fromDefId) {
    throw new TypedError("STRUCTURE_STALE", "structure changed — retry");
  }

  await moveItems(tx, [
    { characterId, itemId: "wood", qty: -params.cost.wood },
    { characterId, itemId: "stone", qty: -params.cost.stone },
  ]);
  await moveShards(tx, characterId, -params.cost.shards, "structure_upgrade", plot.id);

  await tx
    .update(structures)
    .set({ defId: params.toDefId, level: params.toTier })
    .where(eq(structures.id, s.id));

  return {
    id: s.id,
    plotIndex: plot.plotIndex,
    defId: params.toDefId,
    x: s.x,
    y: s.y,
    w: s.w,
    h: s.h,
    rotation: s.rotation,
    tier: params.toTier,
  };
}

/**
 * Remove an owned structure, refunding a fraction of its cost back to the owner
 * (materials to the backpack, Shards ledgered). Locked + def-checked like upgrade.
 *
 * @throws TypedError `STRUCTURE_NOT_FOUND` | `NOT_PLOT_OWNER` | `STRUCTURE_STALE`
 */
export async function removeStructure(
  tx: Tx,
  characterId: string,
  structureId: string,
  params: { expectedDefId: string; refund: StructureCost },
): Promise<{ plotIndex: number }> {
  const [s] = await tx
    .select()
    .from(structures)
    .where(eq(structures.id, structureId))
    .for("update");
  if (!s || !s.plotId) throw new TypedError("STRUCTURE_NOT_FOUND", "no such structure");

  const [plot] = await tx.select().from(plots).where(eq(plots.id, s.plotId));
  if (!plot || plot.ownerId !== characterId) {
    throw new TypedError("NOT_PLOT_OWNER", "not your structure");
  }
  if (s.defId !== params.expectedDefId) {
    throw new TypedError("STRUCTURE_STALE", "structure changed — retry");
  }

  await tx.delete(structures).where(eq(structures.id, s.id));

  await moveItems(tx, [
    { characterId, itemId: "wood", qty: params.refund.wood },
    { characterId, itemId: "stone", qty: params.refund.stone },
  ]);
  if (params.refund.shards > 0) {
    await moveShards(tx, characterId, params.refund.shards, "structure_refund", plot.id);
  }

  return { plotIndex: plot.plotIndex };
}

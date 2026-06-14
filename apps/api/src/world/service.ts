import {
  characters,
  claimPlot,
  inventorySlots,
  moveItems,
  placeStructure,
  plots,
  removeStructure,
  structures,
  type Tx,
  upgradeStructure,
  worldNodes,
} from "@crypto-valley/db";
import {
  CLAIM_COST_SHARDS,
  GATHER,
  GATHER_NODE_BY_ID,
  GATHER_NODES,
  GATHER_RESPAWN_GAME_MS,
  nextStructure,
  nodeAvailable,
  PLOT_H,
  PLOT_W,
  PLOTS,
  plotAt,
  STRUCTURE_BY_ID,
  structureRefund,
} from "@crypto-valley/content";
import type { WorldAction, WorldState } from "@crypto-valley/shared";
import { ENERGY_MAX, regenEnergy } from "@crypto-valley/sim";
import { count, eq } from "drizzle-orm";

import { db } from "../db";

// Same dev clock the farm service uses (FAST_CLOCK speeds the world 8×).
const CLOCK_FACTOR = process.env.FAST_CLOCK === "1" ? 8 : 1;
/** Real ms a gathered node stays depleted: one in-game day, clock-scaled. */
const NODE_RESPAWN_MS = GATHER_RESPAWN_GAME_MS / CLOCK_FACTOR;

/** Player-facing rule violation; routes map it to WorldActionResult.error. */
export class WorldError extends Error {}

/** The stored character name is `<display>_<6hex>`; recover the display part. */
const displayName = (stored: string): string => stored.replace(/_[0-9a-f]{6}$/i, "");

/** Idempotently seed the fixed plot grid (cheap count-guarded upsert). */
async function ensurePlots(): Promise<void> {
  const [{ n }] = await db().select({ n: count() }).from(plots);
  if (n >= PLOTS.length) return;
  await db()
    .insert(plots)
    .values(PLOTS.map((p) => ({ plotIndex: p.index, x: p.x, y: p.y, w: PLOT_W, h: PLOT_H })))
    .onConflictDoNothing();
}

async function sumItems(characterId: string): Promise<Map<string, number>> {
  const rows = await db()
    .select({ itemId: inventorySlots.itemId, qty: inventorySlots.qty })
    .from(inventorySlots)
    .where(eq(inventorySlots.characterId, characterId));
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.itemId, (m.get(r.itemId) ?? 0) + r.qty);
  return m;
}

// ----------------------------------------------------------------- read state
export async function getWorldState(characterId: string, now: number): Promise<WorldState> {
  await ensurePlots();
  const database = db();

  const [char] = await database.select().from(characters).where(eq(characters.id, characterId));
  if (!char) throw new WorldError("CHARACTER_NOT_FOUND");

  const plotRows = await database
    .select({
      index: plots.plotIndex,
      ownerId: plots.ownerId,
      ownerName: characters.name,
      x: plots.x,
      y: plots.y,
      w: plots.w,
      h: plots.h,
    })
    .from(plots)
    .leftJoin(characters, eq(plots.ownerId, characters.id));

  // Only PLOT structures (farm machines have null plot_id and are excluded).
  const structureRows = await database
    .select({
      id: structures.id,
      plotIndex: plots.plotIndex,
      defId: structures.defId,
      x: structures.x,
      y: structures.y,
      w: structures.w,
      h: structures.h,
      rotation: structures.rotation,
      tier: structures.level,
    })
    .from(structures)
    .innerJoin(plots, eq(structures.plotId, plots.id));

  const nodeRows = await database.select().from(worldNodes);
  const harvestedAt = new Map(nodeRows.map((r) => [r.nodeId, r.harvestedAt.getTime()]));
  const items = await sumItems(characterId);
  const owned = plotRows.find((p) => p.ownerId === characterId);

  return {
    plots: plotRows
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((p) => ({
        index: p.index,
        ownerId: p.ownerId,
        ownerName: p.ownerName ? displayName(p.ownerName) : null,
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
      })),
    structures: structureRows,
    nodes: GATHER_NODES.map((n) => ({
      id: n.id,
      kind: n.kind,
      x: n.x,
      y: n.y,
      available: nodeAvailable(harvestedAt.get(n.id) ?? null, now, NODE_RESPAWN_MS),
    })),
    me: {
      shards: char.shards,
      energy: regenEnergy(char.energy, char.energyUpdated.getTime(), now),
      energyMax: ENERGY_MAX,
      wood: items.get("wood") ?? 0,
      stone: items.get("stone") ?? 0,
      ownedPlot: owned ? owned.index : null,
    },
  };
}

// ----------------------------------------------------------------- act
export async function worldAct(input: WorldAction, now: number): Promise<{ toast?: string }> {
  const characterId = input.characterId;
  await ensurePlots(); // don't depend on a prior /world/state call

  const toast = await db().transaction(async (tx): Promise<string | undefined> => {
    const [char] = await tx
      .select()
      .from(characters)
      .where(eq(characters.id, characterId))
      .for("update");
    if (!char) throw new WorldError("CHARACTER_NOT_FOUND");

    switch (input.action) {
      case "claim": {
        const def = PLOTS.find((p) => p.index === input.plotIndex);
        if (!def) throw new WorldError("PLOT_NOT_FOUND");
        if (plotAt(input.posX, input.posY)?.index !== input.plotIndex) {
          throw new WorldError("OUT_OF_RANGE");
        }
        await claimPlot(tx, characterId, input.plotIndex, CLAIM_COST_SHARDS, new Date(now));
        return `Claimed plot · −${CLAIM_COST_SHARDS} Shards`;
      }

      case "chop":
      case "mine":
        return gather(tx, char, input, now);

      case "place": {
        const def = STRUCTURE_BY_ID[input.defId];
        if (!def || !def.placeable) throw new WorldError("BAD_STRUCTURE");
        await placeStructure(tx, characterId, {
          defId: def.id,
          x: input.x,
          y: input.y,
          w: def.footprint.w,
          h: def.footprint.h,
          rotation: input.rotation,
          tier: def.tier,
          cost: def.cost,
        });
        return `Placed ${def.name}`;
      }

      case "upgrade": {
        const [s] = await tx
          .select({ defId: structures.defId })
          .from(structures)
          .where(eq(structures.id, input.structureId));
        if (!s) throw new WorldError("STRUCTURE_NOT_FOUND");
        const next = nextStructure(s.defId);
        if (!next) throw new WorldError("STRUCTURE_MAX_TIER");
        await upgradeStructure(tx, characterId, input.structureId, {
          fromDefId: s.defId,
          toDefId: next.id,
          toTier: next.tier,
          cost: next.cost,
        });
        return `Upgraded to ${next.name}`;
      }

      case "remove": {
        const [s] = await tx
          .select({ defId: structures.defId })
          .from(structures)
          .where(eq(structures.id, input.structureId));
        if (!s) throw new WorldError("STRUCTURE_NOT_FOUND");
        const def = STRUCTURE_BY_ID[s.defId];
        if (!def) throw new WorldError("BAD_STRUCTURE");
        await removeStructure(tx, characterId, input.structureId, {
          expectedDefId: s.defId,
          refund: structureRefund(def),
        });
        return `Removed ${def.name} (refund)`;
      }
    }
  });

  return { toast };
}

/** Shared chop/mine handler — adjacency + energy + respawn, server-validated. */
async function gather(
  tx: Tx,
  char: typeof characters.$inferSelect,
  input: Extract<WorldAction, { action: "chop" | "mine" }>,
  now: number,
): Promise<string> {
  const wantKind = input.action === "chop" ? "tree" : "rock";
  const node = GATHER_NODE_BY_ID[input.nodeId];
  if (!node || node.kind !== wantKind) throw new WorldError("BAD_NODE");
  if (Math.abs(node.x - input.posX) > 1 || Math.abs(node.y - input.posY) > 1) {
    throw new WorldError("OUT_OF_RANGE");
  }

  const cfg = GATHER[node.kind];
  const energy = regenEnergy(char.energy, char.energyUpdated.getTime(), now);
  if (energy < cfg.energy) throw new WorldError("INSUFFICIENT_ENERGY");

  const [existing] = await tx
    .select()
    .from(worldNodes)
    .where(eq(worldNodes.nodeId, input.nodeId))
    .for("update");
  const lastAt = existing ? existing.harvestedAt.getTime() : null;
  if (!nodeAvailable(lastAt, now, NODE_RESPAWN_MS)) throw new WorldError("NODE_DEPLETED");

  await moveItems(tx, [{ characterId: char.id, itemId: cfg.item, qty: cfg.qty }]);
  await tx
    .insert(worldNodes)
    .values({ nodeId: input.nodeId, harvestedAt: new Date(now) })
    .onConflictDoUpdate({ target: worldNodes.nodeId, set: { harvestedAt: new Date(now) } });

  const skills = (char.skills as Record<string, number>) ?? {};
  await tx
    .update(characters)
    .set({
      energy: energy - cfg.energy,
      energyUpdated: new Date(now),
      skills: { ...skills, [cfg.skill]: (skills[cfg.skill] ?? 0) + 1 },
    })
    .where(eq(characters.id, char.id));

  return node.kind === "tree" ? `+${cfg.qty} Wood` : `+${cfg.qty} Stone`;
}

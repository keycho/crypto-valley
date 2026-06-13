import {
  accounts,
  characters,
  crops,
  farms,
  farmTiles,
  inventorySlots,
  itemDefs,
  moveItems,
} from "@crypto-valley/db";
import { CROPS, inFarmPlot, ITEMS, SEED_TO_CROP } from "@crypto-valley/content";
import type { FarmState } from "@crypto-valley/shared";
import {
  ACTION_ENERGY,
  bankGrowth,
  cropStage,
  ENERGY_MAX,
  regenEnergy,
  type CropDef,
} from "@crypto-valley/sim";
import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { db } from "../db";

// Dev clock: FAST_CLOCK speeds growth 8x so a crop matures in under a minute
// (matches the web's NEXT_PUBLIC_FAST_CLOCK day cycle).
const CLOCK_FACTOR = process.env.FAST_CLOCK === "1" ? 8 : 1;
const WORLD_EPOCH = Date.UTC(2026, 0, 1);
const SEASON_MS = 7 * 24 * 3600 * 1000;
const TILE_WATER_MS = 600_000 / CLOCK_FACTOR;

const seasonAt = (now: number): number =>
  ((Math.floor((now - WORLD_EPOCH) / SEASON_MS) % 4) + 4) % 4;

function defFor(cropId: string): CropDef {
  const c = CROPS[cropId];
  if (!c) throw new ActionError("UNKNOWN_CROP");
  return {
    stages: c.stages,
    msPerStage: (c.secondsPerStage * 1000) / CLOCK_FACTOR,
    seasons: c.seasons,
  };
}
/** One watering carries a crop through its full growth. */
const waterMsFor = (cropId: string): number => {
  const d = defFor(cropId);
  return d.msPerStage * (d.stages + 1);
};

/** Thrown for player-facing rule violations; routes map it to ActionResult.error. */
export class ActionError extends Error {}

const ms = (d: Date | null): number | null => (d ? d.getTime() : null);
const farmingXpOf = (skills: unknown): number => {
  const s = skills as { farming?: number } | null;
  return typeof s?.farming === "number" ? s.farming : 0;
};

// ----------------------------------------------------------------- bootstrap
const DEV_EMAIL = "dev@crypto.valley";

/** Idempotently ensures the dev account/character/farm + starter inventory. */
export async function bootstrap(): Promise<{ characterId: string }> {
  return db().transaction(async (tx) => {
    // Item catalog upsert (so a fresh DB needs no separate db:seed).
    for (const it of ITEMS) {
      await tx
        .insert(itemDefs)
        .values({
          id: it.id,
          category: it.category,
          stackMax: it.stackMax,
          baseValue: it.baseValue,
          tradeable: it.tradeable,
          mintable: it.mintable,
          meta: it.meta,
        })
        .onConflictDoNothing();
    }

    const existing = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.email, DEV_EMAIL));
    if (existing[0]) {
      const [char] = await tx
        .select({ id: characters.id })
        .from(characters)
        .where(eq(characters.accountId, existing[0].id));
      return { characterId: char!.id };
    }

    const accountId = uuidv7();
    await tx.insert(accounts).values({ id: accountId, email: DEV_EMAIL });
    const characterId = uuidv7();
    await tx.insert(characters).values({
      id: characterId,
      accountId,
      name: `Dev${characterId.replace(/-/g, "").slice(0, 8)}`,
      appearance: {},
      shards: 500,
    });
    await tx.insert(farms).values({ id: uuidv7(), ownerId: characterId, name: "Home Plot" });

    // starter kit
    await moveItems(tx, [
      { characterId, itemId: "hoe_t1", qty: 1 },
      { characterId, itemId: "watering_can_t1", qty: 1 },
      { characterId, itemId: "seed_bitberry", qty: 20 },
    ]);

    return { characterId };
  });
}

/**
 * Creates a fresh account + character (+ farm + starter kit) for a new player,
 * persisting their chosen display name and appearance. Returns the character id,
 * which doubles as the multiplayer token identity (dev:<characterId>).
 */
export async function createCharacter(
  name: string,
  appearance: unknown,
): Promise<{ characterId: string }> {
  const display = name.trim().slice(0, 16) || "Player";
  return db().transaction(async (tx) => {
    for (const it of ITEMS) {
      await tx
        .insert(itemDefs)
        .values({
          id: it.id,
          category: it.category,
          stackMax: it.stackMax,
          baseValue: it.baseValue,
          tradeable: it.tradeable,
          mintable: it.mintable,
          meta: it.meta,
        })
        .onConflictDoNothing();
    }
    const accountId = uuidv7();
    await tx.insert(accounts).values({ id: accountId, email: `${accountId}@dev.local` });
    const characterId = uuidv7();
    // characters.name is UNIQUE; the in-game display name comes from the join
    // message, so the stored name is suffixed with the id's RANDOM tail (UUIDv7
    // heads are time-ordered and would collide) to guarantee a unique row.
    const storedName = `${display.slice(0, 9)}_${characterId.replace(/-/g, "").slice(-6)}`;
    await tx.insert(characters).values({
      id: characterId,
      accountId,
      name: storedName,
      appearance: appearance ?? {},
      shards: 500,
    });
    await tx.insert(farms).values({ id: uuidv7(), ownerId: characterId, name: "Home Plot" });
    await moveItems(tx, [
      { characterId, itemId: "hoe_t1", qty: 1 },
      { characterId, itemId: "watering_can_t1", qty: 1 },
      { characterId, itemId: "seed_bitberry", qty: 20 },
    ]);
    return { characterId };
  });
}

// ----------------------------------------------------------------- read state
export async function getFarmState(characterId: string, now: number): Promise<FarmState> {
  const database = db();
  const [char] = await database
    .select()
    .from(characters)
    .where(eq(characters.id, characterId));
  if (!char) throw new ActionError("CHARACTER_NOT_FOUND");
  const [farm] = await database.select().from(farms).where(eq(farms.ownerId, characterId));
  if (!farm) throw new ActionError("FARM_NOT_FOUND");

  const tileRows = await database
    .select()
    .from(farmTiles)
    .where(eq(farmTiles.farmId, farm.id));
  const cropRows = await database.select().from(crops).where(eq(crops.farmId, farm.id));
  const inv = await database
    .select()
    .from(inventorySlots)
    .where(eq(inventorySlots.characterId, characterId));
  const season = seasonAt(now);

  return {
    character: {
      id: characterId,
      energy: regenEnergy(char.energy, char.energyUpdated.getTime(), now),
      energyMax: ENERGY_MAX,
      shards: char.shards,
      farmingXp: farmingXpOf(char.skills),
    },
    tiles: tileRows.map((t) => {
      const wet = (ms(t.wateredUntil) ?? 0) > now;
      return { x: t.x, y: t.y, state: wet ? ("watered" as const) : ("tilled" as const), watered: wet };
    }),
    crops: cropRows.map((c) => {
      const view = cropStage(
        { plantedAt: c.plantedAt.getTime(), wateredUntil: ms(c.wateredUntil), growthCreditMs: c.growthCreditMs },
        defFor(c.cropId),
        now,
        season,
        waterMsFor(c.cropId),
      );
      return {
        x: c.x,
        y: c.y,
        cropId: c.cropId,
        stage: view.stage,
        stages: defFor(c.cropId).stages,
        ready: view.ready,
        dead: view.dead,
        watered: (ms(c.wateredUntil) ?? 0) > now,
      };
    }),
    inventory: inv.map((i) => ({
      container: i.container,
      slot: i.slot,
      itemId: i.itemId,
      qty: i.qty,
    })),
  };
}

// ----------------------------------------------------------------- act
export async function act(
  input: { characterId: string; action: keyof typeof ACTION_ENERGY; x: number; y: number; posX: number; posY: number; itemId?: string },
  now: number,
): Promise<{ toast?: string }> {
  const { characterId, action, x, y, posX, posY, itemId } = input;
  await db().transaction(async (tx) => {
    const [char] = await tx
      .select()
      .from(characters)
      .where(eq(characters.id, characterId))
      .for("update");
    if (!char) throw new ActionError("CHARACTER_NOT_FOUND");

    // range: player must be on or adjacent to the target tile (Chebyshev <= 1)
    if (Math.abs(x - posX) > 1 || Math.abs(y - posY) > 1) {
      throw new ActionError("OUT_OF_RANGE");
    }

    const cost = ACTION_ENERGY[action];
    const energy = regenEnergy(char.energy, char.energyUpdated.getTime(), now);
    if (energy < cost) throw new ActionError("INSUFFICIENT_ENERGY");

    const [farm] = await tx.select().from(farms).where(eq(farms.ownerId, characterId));
    if (!farm) throw new ActionError("FARM_NOT_FOUND");

    const tileWhere = and(eq(farmTiles.farmId, farm.id), eq(farmTiles.x, x), eq(farmTiles.y, y));
    const cropWhere = and(eq(crops.farmId, farm.id), eq(crops.x, x), eq(crops.y, y));
    const [tile] = await tx.select().from(farmTiles).where(tileWhere).for("update");
    const [crop] = await tx.select().from(crops).where(cropWhere).for("update");

    if (action === "hoe") {
      if (!inFarmPlot(x, y)) throw new ActionError("NOT_TILLABLE");
      if (tile) throw new ActionError("ALREADY_TILLED");
      if (crop) throw new ActionError("OCCUPIED");
      await tx.insert(farmTiles).values({ farmId: farm.id, x, y, state: "tilled", wateredUntil: null });
    } else if (action === "water") {
      if (!tile) throw new ActionError("NOT_TILLED");
      const until = new Date(now + TILE_WATER_MS);
      await tx.update(farmTiles).set({ state: "watered", wateredUntil: until }).where(tileWhere);
      if (crop) {
        const banked = bankGrowth(
          { plantedAt: crop.plantedAt.getTime(), wateredUntil: ms(crop.wateredUntil), growthCreditMs: crop.growthCreditMs },
          now,
          waterMsFor(crop.cropId),
        );
        await tx
          .update(crops)
          .set({ growthCreditMs: banked, wateredUntil: new Date(now + waterMsFor(crop.cropId)) })
          .where(cropWhere);
      }
    } else if (action === "plant") {
      if (!tile) throw new ActionError("NOT_TILLED");
      if (crop) throw new ActionError("OCCUPIED");
      const seed = itemId ?? "";
      const cropId = SEED_TO_CROP[seed];
      if (!cropId) throw new ActionError("NOT_A_SEED");
      await moveItems(tx, [{ characterId, itemId: seed, qty: -1 }]); // throws INSUFFICIENT_ITEMS
      const wet = (ms(tile.wateredUntil) ?? 0) > now;
      await tx.insert(crops).values({
        id: uuidv7(),
        farmId: farm.id,
        x,
        y,
        cropId,
        plantedAt: new Date(now),
        wateredUntil: wet ? new Date(now + waterMsFor(cropId)) : null,
        growthCreditMs: 0,
        seasonPlanted: seasonAt(now),
      });
    } else {
      // harvest
      if (!crop) throw new ActionError("NOTHING_TO_HARVEST");
      const def = CROPS[crop.cropId];
      const view = cropStage(
        { plantedAt: crop.plantedAt.getTime(), wateredUntil: ms(crop.wateredUntil), growthCreditMs: crop.growthCreditMs },
        defFor(crop.cropId),
        now,
        seasonAt(now),
        waterMsFor(crop.cropId),
      );
      if (!view.ready) throw new ActionError("NOT_READY");
      await tx.delete(crops).where(cropWhere);
      await moveItems(tx, [{ characterId, itemId: def!.produce, qty: def!.produceQty }]);
      const skills = (char.skills as Record<string, number>) ?? {};
      await tx
        .update(characters)
        .set({ skills: { ...skills, farming: (skills.farming ?? 0) + def!.xp } })
        .where(eq(characters.id, characterId));
    }

    // spend energy (skills update above already wrote; do energy in all cases)
    await tx
      .update(characters)
      .set({ energy: energy - cost, energyUpdated: new Date(now) })
      .where(eq(characters.id, characterId));
  });

  return toastFor(input.action, input.itemId);
}

function toastFor(action: string, itemId?: string): { toast?: string } {
  if (action === "harvest") return { toast: "+2 Bitberry · +12 Farming" };
  if (action === "plant") return { toast: `Planted ${itemId ?? "seed"}` };
  return {};
}

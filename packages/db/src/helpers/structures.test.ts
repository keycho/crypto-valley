import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TypedError } from "../errors";
import { characters, ledger, plots, structures } from "../schema";
import { seedCharacter, seedItemDef, seedSlot } from "../test-utils";
import { createTestDb, type TestDb } from "../testing";
import { placeStructure, removeStructure, upgradeStructure } from "./structures";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
  await seedItemDef(t.db, "wood");
  await seedItemDef(t.db, "stone");
});
afterAll(async () => {
  await t.cleanup();
});

let nextIndex = 0;
/** Insert a plot owned by `ownerId` (bypasses the claim fee for setup). */
async function seedOwnedPlot(ownerId: string): Promise<number> {
  const idx = nextIndex++;
  await t.db
    .insert(plots)
    .values({ plotIndex: idx, ownerId, x: 10, y: 10, w: 6, h: 6, claimedAt: new Date() });
  return idx;
}

const HUT = { defId: "hut", w: 2, h: 2, rotation: 0, tier: 1, cost: { wood: 8, stone: 0, shards: 15 } };

/** A character that owns a plot + has materials. Returns id + the plot index. */
async function richOwner(): Promise<{ id: string; plotIndex: number }> {
  const id = await seedCharacter(t.db, 500);
  const plotIndex = await seedOwnedPlot(id);
  await seedSlot(t.db, id, 0, "wood", 200);
  await seedSlot(t.db, id, 1, "stone", 200);
  return { id, plotIndex };
}

describe("placeStructure", () => {
  it("happy path: validates, consumes materials + Shards (ledgered), inserts the row", async () => {
    const { id, plotIndex } = await richOwner();
    const row = await t.db.transaction((tx) => placeStructure(tx, id, { ...HUT, plotIndex, x: 10, y: 10 }));
    expect(row.defId).toBe("hut");
    expect(row.tier).toBe(1);

    const pid = await plotId(row.plotIndex);
    const rows = await t.db.select().from(structures).where(eq(structures.plotId, pid));
    expect(rows).toHaveLength(1);
    expect(rows[0].level).toBe(1);
    expect(rows[0].w).toBe(2);

    const [char] = await t.db.select().from(characters).where(eq(characters.id, id));
    expect(char.shards).toBe(485); // 500 - 15
    const led = await t.db.select().from(ledger).where(eq(ledger.characterId, id));
    expect(led.at(-1)?.reason).toBe("structure_place");
  });

  it("rejects a footprint outside the plot bounds", async () => {
    const { id, plotIndex } = await richOwner();
    await expect(
      t.db.transaction((tx) => placeStructure(tx, id, { ...HUT, plotIndex, x: 15, y: 15 })), // 15+2 > 16
    ).rejects.toMatchObject({ code: "OUT_OF_BOUNDS" });
  });

  it("rejects overlapping another structure", async () => {
    const { id, plotIndex } = await richOwner();
    await t.db.transaction((tx) => placeStructure(tx, id, { ...HUT, plotIndex, x: 10, y: 10 }));
    await expect(
      t.db.transaction((tx) => placeStructure(tx, id, { ...HUT, plotIndex, x: 11, y: 11 })), // overlaps
    ).rejects.toMatchObject({ code: "OVERLAP" });
  });

  it("rejects building on a plot you don't own", async () => {
    const id = await seedCharacter(t.db, 500);
    await seedSlot(t.db, id, 0, "wood", 200);
    const owner = await seedCharacter(t.db, 500);
    const plotIndex = await seedOwnedPlot(owner); // someone else's plot
    await expect(
      t.db.transaction((tx) => placeStructure(tx, id, { ...HUT, plotIndex, x: 10, y: 10 })),
    ).rejects.toMatchObject({ code: "NOT_PLOT_OWNER" });
  });

  it("rejects (and rolls back the Shards spend) without the materials", async () => {
    const id = await seedCharacter(t.db, 500);
    const plotIndex = await seedOwnedPlot(id); // owns a plot but has no wood
    await expect(
      t.db.transaction((tx) => placeStructure(tx, id, { ...HUT, plotIndex, x: 10, y: 10 })),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_ITEMS" });
    const [char] = await t.db.select().from(characters).where(eq(characters.id, id));
    expect(char.shards).toBe(500); // no partial spend
  });

  it("concurrent: two placements on the same tile → exactly one wins", async () => {
    const { id, plotIndex } = await richOwner();
    const results = await Promise.allSettled([
      t.db.transaction((tx) => placeStructure(tx, id, { ...HUT, plotIndex, x: 12, y: 12 })),
      t.db.transaction((tx) => placeStructure(tx, id, { ...HUT, plotIndex, x: 12, y: 12 })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect((lost!.reason as TypedError).code).toBe("OVERLAP");
  });
});

describe("upgradeStructure", () => {
  const CABIN = { toDefId: "cabin", toTier: 2, cost: { wood: 18, stone: 6, shards: 30 } };

  it("happy path: bumps def + tier, consumes cost, ledgers", async () => {
    const { id, plotIndex } = await richOwner();
    const s = await t.db.transaction((tx) => placeStructure(tx, id, { ...HUT, plotIndex, x: 10, y: 10 }));
    const up = await t.db.transaction((tx) =>
      upgradeStructure(tx, id, s.id, { fromDefId: "hut", ...CABIN }),
    );
    expect(up.defId).toBe("cabin");
    expect(up.tier).toBe(2);
    const [row] = await t.db.select().from(structures).where(eq(structures.id, s.id));
    expect(row.defId).toBe("cabin");
    expect(row.level).toBe(2);
    const led = await t.db.select().from(ledger).where(eq(ledger.characterId, id));
    expect(led.at(-1)?.reason).toBe("structure_upgrade");
  });

  it("rejects upgrading someone else's structure", async () => {
    const { id, plotIndex } = await richOwner();
    const other = await seedCharacter(t.db, 500);
    await seedSlot(t.db, other, 0, "wood", 200);
    await seedSlot(t.db, other, 1, "stone", 200);
    const s = await t.db.transaction((tx) => placeStructure(tx, id, { ...HUT, plotIndex, x: 10, y: 10 }));
    await expect(
      t.db.transaction((tx) => upgradeStructure(tx, other, s.id, { fromDefId: "hut", ...CABIN })),
    ).rejects.toMatchObject({ code: "NOT_PLOT_OWNER" });
  });

  it("rejects a stale upgrade (def changed under us)", async () => {
    const { id, plotIndex } = await richOwner();
    const s = await t.db.transaction((tx) => placeStructure(tx, id, { ...HUT, plotIndex, x: 10, y: 10 }));
    await expect(
      t.db.transaction((tx) =>
        upgradeStructure(tx, id, s.id, { fromDefId: "tower", ...CABIN }),
      ),
    ).rejects.toMatchObject({ code: "STRUCTURE_STALE" });
  });
});

describe("removeStructure", () => {
  it("deletes the structure and refunds materials + Shards", async () => {
    const { id, plotIndex } = await richOwner();
    const s = await t.db.transaction((tx) => placeStructure(tx, id, { ...HUT, plotIndex, x: 10, y: 10 }));
    // after place: 500 - 15 = 485 shards
    await t.db.transaction((tx) =>
      removeStructure(tx, id, s.id, { expectedDefId: "hut", refund: { wood: 4, stone: 0, shards: 7 } }),
    );
    const rows = await t.db.select().from(structures).where(eq(structures.id, s.id));
    expect(rows).toHaveLength(0);
    const [char] = await t.db.select().from(characters).where(eq(characters.id, id));
    expect(char.shards).toBe(492); // 485 + 7
    const led = await t.db.select().from(ledger).where(eq(ledger.characterId, id));
    expect(led.at(-1)?.reason).toBe("structure_refund");
  });

  it("rejects removing someone else's structure", async () => {
    const { id, plotIndex } = await richOwner();
    const other = await seedCharacter(t.db, 500);
    const s = await t.db.transaction((tx) => placeStructure(tx, id, { ...HUT, plotIndex, x: 10, y: 10 }));
    await expect(
      t.db.transaction((tx) =>
        removeStructure(tx, other, s.id, { expectedDefId: "hut", refund: { wood: 4, stone: 0, shards: 7 } }),
      ),
    ).rejects.toMatchObject({ code: "NOT_PLOT_OWNER" });
  });
});

/** Look up a plot's row id from its content index (test helper). */
async function plotId(index: number): Promise<string> {
  const [row] = await t.db.select({ id: plots.id }).from(plots).where(eq(plots.plotIndex, index));
  return row.id;
}

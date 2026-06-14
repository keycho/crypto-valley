import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TypedError } from "../errors";
import { characters, ledger, plots } from "../schema";
import { seedCharacter, seedItemDef, seedSlot } from "../test-utils";
import { createTestDb, type TestDb } from "../testing";
import { claimPlot, type TierCost, upgradePlot } from "./plots";

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
/** Insert a fresh unclaimed plot row; returns its content index. */
async function seedPlot(): Promise<number> {
  const idx = nextIndex++;
  await t.db.insert(plots).values({ plotIndex: idx, x: 10, y: 10, w: 6, h: 6 });
  return idx;
}

// Cost ladder used by the upgrade tests (mirrors content shape).
const COSTS: TierCost[] = [
  { wood: 0, stone: 0, shards: 0 },
  { wood: 8, stone: 0, shards: 20 },
  { wood: 20, stone: 8, shards: 50 },
];

describe("claimPlot", () => {
  it("happy path: assigns ownership, charges the fee, writes a ledger row", async () => {
    const id = await seedCharacter(t.db, 500);
    const idx = await seedPlot();

    const row = await t.db.transaction((tx) => claimPlot(tx, id, idx, 40, new Date()));
    expect(row.tier).toBe(0);
    expect(row.ownerId).toBe(id);

    const [plot] = await t.db.select().from(plots).where(eq(plots.plotIndex, idx));
    expect(plot.ownerId).toBe(id);
    expect(plot.claimedAt).not.toBeNull();

    const [char] = await t.db.select().from(characters).where(eq(characters.id, id));
    expect(char.shards).toBe(460);

    const rows = await t.db.select().from(ledger).where(eq(ledger.characterId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].deltaShards).toBe(-40);
    expect(rows[0].reason).toBe("plot_claim");
  });

  it("rejects claiming a second plot (one per player)", async () => {
    const id = await seedCharacter(t.db, 500);
    const a = await seedPlot();
    const b = await seedPlot();
    await t.db.transaction((tx) => claimPlot(tx, id, a, 40, new Date()));
    await expect(
      t.db.transaction((tx) => claimPlot(tx, id, b, 40, new Date())),
    ).rejects.toMatchObject({ code: "ALREADY_OWN_PLOT" });
  });

  it("rejects claiming someone else's plot", async () => {
    const owner = await seedCharacter(t.db, 500);
    const other = await seedCharacter(t.db, 500);
    const idx = await seedPlot();
    await t.db.transaction((tx) => claimPlot(tx, owner, idx, 40, new Date()));
    await expect(
      t.db.transaction((tx) => claimPlot(tx, other, idx, 40, new Date())),
    ).rejects.toMatchObject({ code: "PLOT_TAKEN" });
  });

  it("rejects when the fee exceeds the balance (and stays unclaimed)", async () => {
    const id = await seedCharacter(t.db, 10);
    const idx = await seedPlot();
    await expect(
      t.db.transaction((tx) => claimPlot(tx, id, idx, 40, new Date())),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    const [plot] = await t.db.select().from(plots).where(eq(plots.plotIndex, idx));
    expect(plot.ownerId).toBeNull();
  });

  it("concurrent: 5 players race for one plot → exactly one wins", async () => {
    const idx = await seedPlot();
    const ids = await Promise.all(
      Array.from({ length: 5 }, () => seedCharacter(t.db, 500)),
    );
    const results = await Promise.allSettled(
      ids.map((id) => t.db.transaction((tx) => claimPlot(tx, id, idx, 40, new Date()))),
    );
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(4);
    for (const r of lost) {
      expect(r.reason).toBeInstanceOf(TypedError);
      expect((r.reason as TypedError).code).toBe("PLOT_TAKEN");
    }
    const [plot] = await t.db.select().from(plots).where(eq(plots.plotIndex, idx));
    expect(plot.ownerId).not.toBeNull();
  });
});

describe("upgradePlot", () => {
  it("happy path: consumes materials + Shards, ledgers, bumps the tier", async () => {
    const id = await seedCharacter(t.db, 500);
    const idx = await seedPlot();
    await t.db.transaction((tx) => claimPlot(tx, id, idx, 40, new Date())); // -> 460 shards
    await seedSlot(t.db, id, 0, "wood", 50);

    const row = await t.db.transaction((tx) => upgradePlot(tx, id, idx, COSTS));
    expect(row.tier).toBe(1);

    const [char] = await t.db.select().from(characters).where(eq(characters.id, id));
    expect(char.shards).toBe(440); // 460 - 20

    const [plot] = await t.db.select().from(plots).where(eq(plots.plotIndex, idx));
    expect(plot.tier).toBe(1);

    const rows = await t.db.select().from(ledger).where(eq(ledger.characterId, id));
    expect(rows.map((r) => r.reason)).toEqual(["plot_claim", "plot_upgrade"]);
  });

  it("rejects upgrading a plot you don't own", async () => {
    const owner = await seedCharacter(t.db, 500);
    const other = await seedCharacter(t.db, 500);
    const idx = await seedPlot();
    await t.db.transaction((tx) => claimPlot(tx, owner, idx, 40, new Date()));
    await seedSlot(t.db, other, 0, "wood", 50);
    await expect(
      t.db.transaction((tx) => upgradePlot(tx, other, idx, COSTS)),
    ).rejects.toMatchObject({ code: "NOT_PLOT_OWNER" });
  });

  it("rejects (and rolls back the Shards spend) without the materials", async () => {
    const id = await seedCharacter(t.db, 500);
    const idx = await seedPlot();
    await t.db.transaction((tx) => claimPlot(tx, id, idx, 40, new Date())); // 460
    // no wood/stone in the backpack
    await expect(
      t.db.transaction((tx) => upgradePlot(tx, id, idx, COSTS)),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_ITEMS" });

    const [char] = await t.db.select().from(characters).where(eq(characters.id, id));
    expect(char.shards).toBe(460); // upgrade rolled back — no partial spend
    const [plot] = await t.db.select().from(plots).where(eq(plots.plotIndex, idx));
    expect(plot.tier).toBe(0);
  });

  it("rejects upgrading past the top tier", async () => {
    const id = await seedCharacter(t.db, 5000);
    const idx = await seedPlot();
    await t.db.transaction((tx) => claimPlot(tx, id, idx, 40, new Date()));
    await t.db.update(plots).set({ tier: COSTS.length - 1 }).where(eq(plots.plotIndex, idx));
    await seedSlot(t.db, id, 0, "wood", 999);
    await seedSlot(t.db, id, 1, "stone", 999);
    await expect(
      t.db.transaction((tx) => upgradePlot(tx, id, idx, COSTS)),
    ).rejects.toMatchObject({ code: "PLOT_MAX_TIER" });
  });
});

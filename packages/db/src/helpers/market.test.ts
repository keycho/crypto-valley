import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TypedError } from "../errors";
import { characters, ledger, listings, plots, structures, treasury } from "../schema";
import { seedCharacter } from "../test-utils";
import { createTestDb, type TestDb } from "../testing";
import { buyPlot, listPlot, unlistPlot } from "./market";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.cleanup();
});

let nextIndex = 0;
async function seedPlot(ownerId: string): Promise<{ index: number; id: string }> {
  const index = nextIndex++;
  const [row] = await t.db
    .insert(plots)
    .values({ plotIndex: index, ownerId, x: 10, y: 10, w: 6, h: 6, claimedAt: new Date() })
    .returning({ id: plots.id });
  return { index, id: row.id };
}
const shardsOf = async (id: string): Promise<number> =>
  (await t.db.select().from(characters).where(eq(characters.id, id)))[0].shards;
const treasuryOf = async (): Promise<number> => {
  const [row] = await t.db.select().from(treasury).where(eq(treasury.currency, "shards"));
  return row?.balance ?? 0;
};
const activeListing = async (plotId: string) =>
  (await t.db.select().from(listings).where(and(eq(listings.plotId, plotId), eq(listings.status, "active"))))[0];

describe("land market", () => {
  it("list → buy: Shards move (minus fee → treasury), ownership transfers, listing sold, ledgered", async () => {
    const seller = await seedCharacter(t.db, 500);
    const buyer = await seedCharacter(t.db, 500);
    const plot = await seedPlot(seller);
    const t0 = await treasuryOf();

    await t.db.transaction((tx) => listPlot(tx, seller, plot.index, 100, "shards"));
    const res = await t.db.transaction((tx) => buyPlot(tx, buyer, plot.index, 8, 500, new Date()));

    expect(res.fee).toBe(5); // 5% of 100
    expect(await shardsOf(buyer)).toBe(400); // -100
    expect(await shardsOf(seller)).toBe(595); // +95 (100 - 5 fee)
    expect(await treasuryOf()).toBe(t0 + 5);

    const [p] = await t.db.select().from(plots).where(eq(plots.plotIndex, plot.index));
    expect(p.ownerId).toBe(buyer);
    const [l] = await t.db.select().from(listings).where(eq(listings.plotId, plot.id));
    expect(l.status).toBe("sold");
    expect(l.soldTo).toBe(buyer);

    const led = await t.db.select().from(ledger).where(eq(ledger.characterId, buyer));
    expect(led.at(-1)?.reason).toBe("land_buy");
    const sled = await t.db.select().from(ledger).where(eq(ledger.characterId, seller));
    expect(sled.at(-1)?.reason).toBe("land_sale");
  });

  it("structures stay with the plot on sale", async () => {
    const seller = await seedCharacter(t.db, 500);
    const buyer = await seedCharacter(t.db, 500);
    const plot = await seedPlot(seller);
    await t.db.insert(structures).values({ plotId: plot.id, defId: "hut", x: 10, y: 10, w: 2, h: 2, level: 1 });
    await t.db.transaction((tx) => listPlot(tx, seller, plot.index, 100, "shards"));
    await t.db.transaction((tx) => buyPlot(tx, buyer, plot.index, 8, 500, new Date()));
    const structs = await t.db.select().from(structures).where(eq(structures.plotId, plot.id));
    expect(structs).toHaveLength(1); // building transferred with the land
  });

  it("can't buy your own listing", async () => {
    const seller = await seedCharacter(t.db, 500);
    const plot = await seedPlot(seller);
    await t.db.transaction((tx) => listPlot(tx, seller, plot.index, 50, "shards"));
    await expect(
      t.db.transaction((tx) => buyPlot(tx, seller, plot.index, 8, 500, new Date())),
    ).rejects.toMatchObject({ code: "CANT_BUY_OWN" });
  });

  it("can't buy without enough Shards (rolled back; listing stays active)", async () => {
    const seller = await seedCharacter(t.db, 500);
    const buyer = await seedCharacter(t.db, 50);
    const plot = await seedPlot(seller);
    await t.db.transaction((tx) => listPlot(tx, seller, plot.index, 100, "shards"));
    await expect(
      t.db.transaction((tx) => buyPlot(tx, buyer, plot.index, 8, 500, new Date())),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    expect(await shardsOf(buyer)).toBe(50);
    const [p] = await t.db.select().from(plots).where(eq(plots.plotIndex, plot.index));
    expect(p.ownerId).toBe(seller); // still the seller's
    expect(await activeListing(plot.id)).toBeDefined(); // listing still active
  });

  it("enforces the buyer's plot cap", async () => {
    const seller = await seedCharacter(t.db, 500);
    const buyer = await seedCharacter(t.db, 2000);
    await seedPlot(buyer); // buyer already owns 1
    const plot = await seedPlot(seller);
    await t.db.transaction((tx) => listPlot(tx, seller, plot.index, 100, "shards"));
    await expect(
      t.db.transaction((tx) => buyPlot(tx, buyer, plot.index, 1, 500, new Date())), // cap 1, already at 1
    ).rejects.toMatchObject({ code: "PLOT_CAP_REACHED" });
  });

  it("seller can unlist; then it can't be bought", async () => {
    const seller = await seedCharacter(t.db, 500);
    const buyer = await seedCharacter(t.db, 500);
    const plot = await seedPlot(seller);
    await t.db.transaction((tx) => listPlot(tx, seller, plot.index, 100, "shards"));
    await t.db.transaction((tx) => unlistPlot(tx, seller, plot.index));
    expect(await activeListing(plot.id)).toBeUndefined();
    await expect(
      t.db.transaction((tx) => buyPlot(tx, buyer, plot.index, 8, 500, new Date())),
    ).rejects.toMatchObject({ code: "NOT_LISTED" });
  });

  it("non-owner can't list; price must be positive", async () => {
    const owner = await seedCharacter(t.db, 500);
    const other = await seedCharacter(t.db, 500);
    const plot = await seedPlot(owner);
    await expect(
      t.db.transaction((tx) => listPlot(tx, other, plot.index, 100, "shards")),
    ).rejects.toMatchObject({ code: "NOT_PLOT_OWNER" });
    await expect(
      t.db.transaction((tx) => listPlot(tx, owner, plot.index, 0, "shards")),
    ).rejects.toMatchObject({ code: "BAD_PRICE" });
  });

  it("concurrent: two buyers race for one listing → exactly one wins, no double-spend", async () => {
    const seller = await seedCharacter(t.db, 500);
    const b1 = await seedCharacter(t.db, 2000);
    const b2 = await seedCharacter(t.db, 2000);
    const plot = await seedPlot(seller);
    const t0 = await treasuryOf();
    await t.db.transaction((tx) => listPlot(tx, seller, plot.index, 200, "shards"));

    const results = await Promise.allSettled([
      t.db.transaction((tx) => buyPlot(tx, b1, plot.index, 8, 500, new Date())),
      t.db.transaction((tx) => buyPlot(tx, b2, plot.index, 8, 500, new Date())),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect((lost!.reason as TypedError).code).toBe("NOT_LISTED");

    // seller paid exactly once (200 - 10 fee = +190), treasury += 10 once
    expect(await shardsOf(seller)).toBe(690);
    expect(await treasuryOf()).toBe(t0 + 10);
    const [p] = await t.db.select().from(plots).where(eq(plots.plotIndex, plot.index));
    expect([b1, b2]).toContain(p.ownerId);
  });
});

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TypedError } from "../errors";
import { characters, ledger, plots } from "../schema";
import { seedCharacter } from "../test-utils";
import { createTestDb, type TestDb } from "../testing";
import { claimPlot } from "./plots";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
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

describe("claimPlot", () => {
  it("happy path: assigns ownership, charges the fee, writes a ledger row", async () => {
    const id = await seedCharacter(t.db, 500);
    const idx = await seedPlot();

    const row = await t.db.transaction((tx) => claimPlot(tx, id, idx, 40, new Date()));
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

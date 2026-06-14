import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { characters, listings, plots, seasonResults, seasonScores, seasons, structures, treasury } from "../schema";
import { seedCharacter } from "../test-utils";
import { createTestDb, type TestDb } from "../testing";
import { addSeasonProfit, buildSeasonState, currentSeason } from "./seasons";

let t: TestDb;
const NOW = Date.now();
const WEEK = 7 * 24 * 60 * 60 * 1000;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.cleanup();
});
// isolate season + land state per test (characters/ledger accumulate harmlessly)
beforeEach(async () => {
  await t.db.delete(seasonResults);
  await t.db.delete(seasonScores);
  await t.db.delete(listings);
  await t.db.delete(structures);
  await t.db.delete(plots);
  await t.db.delete(seasons);
  await t.db.delete(treasury);
});

let nextIdx = 0;
async function ownPlot(ownerId: string): Promise<string> {
  const [row] = await t.db
    .insert(plots)
    .values({ plotIndex: nextIdx++, ownerId, x: 10, y: 10, w: 6, h: 6, claimedAt: new Date() })
    .returning({ id: plots.id });
  return row.id;
}
const profitOf = async (sid: string, cid: string): Promise<number> => {
  const [r] = await t.db
    .select()
    .from(seasonScores)
    .where(and(eq(seasonScores.seasonId, sid), eq(seasonScores.characterId, cid)));
  return r?.profit ?? 0;
};
const shardsOf = async (cid: string): Promise<number> =>
  (await t.db.select().from(characters).where(eq(characters.id, cid)))[0].shards;

describe("seasons", () => {
  it("creates season 1 on first use", async () => {
    const { season } = await t.db.transaction((tx) => currentSeason(tx, NOW, WEEK));
    expect(season.number).toBe(1);
    expect(season.status).toBe("active");
    expect(season.endsAt.getTime()).toBeGreaterThan(NOW);
  });

  it("a flip nets profit: buy 80 (−80) then sell 150 (+150) = +70", async () => {
    const a = await seedCharacter(t.db);
    const { season } = await t.db.transaction((tx) => currentSeason(tx, NOW, WEEK));
    await t.db.transaction((tx) => addSeasonProfit(tx, season.id, a, -80, NOW));
    await t.db.transaction((tx) => addSeasonProfit(tx, season.id, a, 150, NOW));
    expect(await profitOf(season.id, a)).toBe(70);
  });

  it("ends a due season: pays top finishers, records results+trophies, resets the board, starts the next — assets untouched", async () => {
    const a = await seedCharacter(t.db, 500);
    const b = await seedCharacter(t.db, 500);
    const c = await seedCharacter(t.db, 500);
    const [s] = await t.db
      .insert(seasons)
      .values({ number: 1, startedAt: new Date(NOW - WEEK), endsAt: new Date(NOW - 1000), status: "active", poolShards: 1000 })
      .returning();
    await t.db.insert(seasonScores).values([
      { seasonId: s.id, characterId: a, profit: 500 },
      { seasonId: s.id, characterId: b, profit: 300 },
      { seasonId: s.id, characterId: c, profit: 100 },
    ]);
    // portfolio: A owns 2 plots, B owns 1
    await ownPlot(a);
    await ownPlot(a);
    await ownPlot(b);
    await t.db.insert(treasury).values({ currency: "shards", balance: 1000 });

    const r = await t.db.transaction((tx) => currentSeason(tx, NOW, WEEK));
    expect(r.ended?.number).toBe(1);
    expect(r.season.number).toBe(2); // a fresh season started
    expect(r.season.poolShards).toBe(0);

    const [s1] = await t.db.select().from(seasons).where(eq(seasons.number, 1));
    expect(s1.status).toBe("ended");

    // prizes: pool 1000 → profit [350,210,140], portfolio (A,B) [150,90]
    expect(await shardsOf(a)).toBe(500 + 350 + 150); // champion + top builder
    expect(await shardsOf(b)).toBe(500 + 210 + 90);
    expect(await shardsOf(c)).toBe(500 + 140);

    const results = await t.db.select().from(seasonResults).where(eq(seasonResults.seasonId, s.id));
    expect(results).toHaveLength(5); // 3 profit + 2 portfolio
    const [tre] = await t.db.select().from(treasury).where(eq(treasury.currency, "shards"));
    expect(tre.balance).toBe(1000 - (350 + 210 + 140 + 150 + 90)); // = 60

    // ASSETS SURVIVE: A still owns its 2 plots; nobody's shards went DOWN
    const aPlots = await t.db.select().from(plots).where(eq(plots.ownerId, a));
    expect(aPlots).toHaveLength(2);
  });

  it("season-end is idempotent — re-running doesn't double-pay", async () => {
    const a = await seedCharacter(t.db, 500);
    const [s] = await t.db
      .insert(seasons)
      .values({ number: 1, startedAt: new Date(NOW - WEEK), endsAt: new Date(NOW - 1000), status: "active", poolShards: 1000 })
      .returning();
    await t.db.insert(seasonScores).values({ seasonId: s.id, characterId: a, profit: 500 });
    await t.db.insert(treasury).values({ currency: "shards", balance: 1000 });

    await t.db.transaction((tx) => currentSeason(tx, NOW, WEEK)); // ends season 1
    const afterFirst = await shardsOf(a);
    await t.db.transaction((tx) => currentSeason(tx, NOW, WEEK)); // season 2 active, not due
    await t.db.transaction((tx) => currentSeason(tx, NOW, WEEK));
    expect(await shardsOf(a)).toBe(afterFirst); // no second payout
    const all = await t.db.select().from(seasonResults).where(eq(seasonResults.seasonId, s.id));
    expect(all.length).toBeGreaterThan(0);
    const s1results = all.filter((r) => r.board === "profit" && r.rank === 1);
    expect(s1results).toHaveLength(1); // exactly one champion recorded
  });

  it("a mid-season joiner competes from zero; trophies persist after reset", async () => {
    const a = await seedCharacter(t.db, 500);
    // end a past season where A won, to mint a trophy
    const [s] = await t.db
      .insert(seasons)
      .values({ number: 1, startedAt: new Date(NOW - WEEK), endsAt: new Date(NOW - 1000), status: "active", poolShards: 100 })
      .returning();
    await t.db.insert(seasonScores).values({ seasonId: s.id, characterId: a, profit: 999 });
    await t.db.insert(treasury).values({ currency: "shards", balance: 100 });
    await t.db.transaction((tx) => currentSeason(tx, NOW, WEEK));

    // a brand-new player joins the now-current season
    const newbie = await seedCharacter(t.db);
    const view = await t.db.transaction((tx) => buildSeasonState(tx, newbie, NOW, WEEK, 10));
    expect(view.number).toBe(2);
    expect(view.me.profit).toBe(0);
    expect(view.me.profitRank).toBeNull();

    // A's trophy from season 1 persists
    const aView = await t.db.transaction((tx) => buildSeasonState(tx, a, NOW, WEEK, 10));
    expect(aView.trophies.some((tr) => tr.seasonNumber === 1 && tr.board === "profit" && tr.rank === 1)).toBe(true);
  });

  it("portfolio board ranks by land + structure value", async () => {
    const rich = await seedCharacter(t.db);
    const poor = await seedCharacter(t.db);
    const { season } = await t.db.transaction((tx) => currentSeason(tx, NOW, WEEK));
    const richPlot = await ownPlot(rich);
    await t.db.insert(structures).values({ plotId: richPlot, defId: "skyscraper", x: 10, y: 10, w: 2, h: 2, level: 6 });
    await ownPlot(poor); // empty plot
    const view = await t.db.transaction((tx) => buildSeasonState(tx, rich, NOW, WEEK, 10));
    expect(view.portfolioBoard[0].characterId).toBe(rich); // 100 + skyscraper value ≫ 100
    expect(view.portfolioBoard[0].score).toBeGreaterThan(view.portfolioBoard[1].score);
    expect(view.me.portfolioRank).toBe(1);
    void season;
  });
});

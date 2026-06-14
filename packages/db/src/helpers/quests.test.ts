import { eq, and } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TypedError } from "../errors";
import { characters, inventorySlots, ledger, questProgress } from "../schema";
import { seedCharacter, seedItemDef } from "../test-utils";
import { createTestDb, type TestDb } from "../testing";
import { advanceQuests, claimQuest, ensureQuests } from "./quests";

let t: TestDb;
const DAY = 100;
beforeAll(async () => {
  t = await createTestDb();
  await seedItemDef(t.db, "wood");
  await seedItemDef(t.db, "stone");
});
afterAll(async () => {
  await t.cleanup();
});

const rowsFor = (id: string) =>
  t.db.select().from(questProgress).where(eq(questProgress.characterId, id));
const wood = async (id: string) => {
  const r = await t.db
    .select()
    .from(inventorySlots)
    .where(and(eq(inventorySlots.characterId, id), eq(inventorySlots.itemId, "wood")));
  return r.reduce((s, x) => s + x.qty, 0);
};

describe("quest engine", () => {
  it("ensureQuests auto-assigns the first story quest + the dailies", async () => {
    const id = await seedCharacter(t.db);
    await t.db.transaction((tx) => ensureQuests(tx, id, DAY));
    const rows = await rowsFor(id);
    const ids = rows.map((r) => r.questId).sort();
    expect(ids).toContain("q1_claim");
    expect(ids).toContain("daily_wood");
    expect(ids).toContain("daily_harvest");
    expect(ids).toContain("daily_build");
    expect(rows.every((r) => r.status === "active")).toBe(true);
  });

  it("claiming a plot completes Q1; claiming the reward grants Shards + wood (ledgered) and unlocks Q2", async () => {
    const id = await seedCharacter(t.db, 500);
    const done = await t.db.transaction((tx) => advanceQuests(tx, id, { type: "claim_plot" }, DAY));
    expect(done).toContain("q1_claim");
    const [q1] = await t.db
      .select()
      .from(questProgress)
      .where(and(eq(questProgress.characterId, id), eq(questProgress.questId, "q1_claim")));
    expect(q1.status).toBe("complete");

    const reward = await t.db.transaction((tx) => claimQuest(tx, id, "q1_claim"));
    expect(reward.shards).toBe(50);
    const [char] = await t.db.select().from(characters).where(eq(characters.id, id));
    expect(char.shards).toBe(550); // 500 + 50
    expect(await wood(id)).toBe(20);
    const led = await t.db.select().from(ledger).where(eq(ledger.characterId, id));
    expect(led.at(-1)?.reason).toBe("quest_reward");

    const [q1b] = await t.db
      .select()
      .from(questProgress)
      .where(and(eq(questProgress.characterId, id), eq(questProgress.questId, "q1_claim")));
    expect(q1b.status).toBe("claimed");
    const [q2] = await t.db
      .select()
      .from(questProgress)
      .where(and(eq(questProgress.characterId, id), eq(questProgress.questId, "q2_timber")));
    expect(q2.status).toBe("active"); // unlocked
  });

  it("can't claim an incomplete quest", async () => {
    const id = await seedCharacter(t.db);
    await t.db.transaction((tx) => ensureQuests(tx, id, DAY));
    await expect(
      t.db.transaction((tx) => claimQuest(tx, id, "q1_claim")),
    ).rejects.toMatchObject({ code: "QUEST_INCOMPLETE" });
  });

  it("can't double-claim (reward granted exactly once)", async () => {
    const id = await seedCharacter(t.db, 500);
    await t.db.transaction((tx) => advanceQuests(tx, id, { type: "claim_plot" }, DAY));
    await t.db.transaction((tx) => claimQuest(tx, id, "q1_claim"));
    await expect(
      t.db.transaction((tx) => claimQuest(tx, id, "q1_claim")),
    ).rejects.toMatchObject({ code: "QUEST_ALREADY_CLAIMED" });
    const [char] = await t.db.select().from(characters).where(eq(characters.id, id));
    expect(char.shards).toBe(550); // not 600 — only one grant
  });

  it("concurrent double-claim → exactly one succeeds", async () => {
    const id = await seedCharacter(t.db, 500);
    await t.db.transaction((tx) => advanceQuests(tx, id, { type: "claim_plot" }, DAY));
    const res = await Promise.allSettled([
      t.db.transaction((tx) => claimQuest(tx, id, "q1_claim")),
      t.db.transaction((tx) => claimQuest(tx, id, "q1_claim")),
    ]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = res.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect((lost!.reason as TypedError).code).toBe("QUEST_ALREADY_CLAIMED");
  });

  it("gather advances Q2 + the wood daily with live progress", async () => {
    const id = await seedCharacter(t.db, 500);
    await t.db.transaction((tx) => advanceQuests(tx, id, { type: "claim_plot" }, DAY));
    await t.db.transaction((tx) => claimQuest(tx, id, "q1_claim")); // unlock q2
    await t.db.transaction((tx) => advanceQuests(tx, id, { type: "gather", item: "wood", qty: 12 }, DAY));
    const [q2] = await t.db
      .select()
      .from(questProgress)
      .where(and(eq(questProgress.characterId, id), eq(questProgress.questId, "q2_timber")));
    expect((q2.objectives as Record<string, number>)["0"]).toBe(12);
    expect(q2.status).toBe("active");
    await t.db.transaction((tx) => advanceQuests(tx, id, { type: "gather", item: "wood", qty: 8 }, DAY));
    const [q2done] = await t.db
      .select()
      .from(questProgress)
      .where(and(eq(questProgress.characterId, id), eq(questProgress.questId, "q2_timber")));
    expect(q2done.status).toBe("complete");
  });

  it("dailies reset on a new game-day", async () => {
    const id = await seedCharacter(t.db);
    await t.db.transaction((tx) => advanceQuests(tx, id, { type: "gather", item: "wood", qty: 30 }, DAY));
    const [d1] = await t.db
      .select()
      .from(questProgress)
      .where(and(eq(questProgress.characterId, id), eq(questProgress.questId, "daily_wood")));
    expect(d1.status).toBe("complete"); // 30 wood done today
    // next game-day → reset to active, progress cleared
    await t.db.transaction((tx) => ensureQuests(tx, id, DAY + 1));
    const [d2] = await t.db
      .select()
      .from(questProgress)
      .where(and(eq(questProgress.characterId, id), eq(questProgress.questId, "daily_wood")));
    expect(d2.status).toBe("active");
    expect(d2.objectives).toEqual({});
  });
});

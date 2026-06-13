import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TypedError } from "../errors";
import { characters, ledger } from "../schema";
import { seedCharacter } from "../test-utils";
import { createTestDb, type TestDb } from "../testing";
import { moveShards } from "./moveShards";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.cleanup();
});

describe("moveShards", () => {
  it("happy path: writes a ledger row matching the delta and reason", async () => {
    const id = await seedCharacter(t.db, 500);

    const balance = await t.db.transaction((tx) =>
      moveShards(tx, id, 100, "quest_reward"),
    );
    expect(balance).toBe(600);

    const [character] = await t.db
      .select()
      .from(characters)
      .where(eq(characters.id, id));
    expect(character.shards).toBe(600);

    const rows = await t.db.select().from(ledger).where(eq(ledger.characterId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].deltaShards).toBe(100);
    expect(rows[0].reason).toBe("quest_reward");
  });

  it("concurrent: 20 parallel -100 from 1000 → exactly 10 succeed, balance 0, 10 ledger rows", async () => {
    const id = await seedCharacter(t.db, 1000);

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        t.db.transaction((tx) => moveShards(tx, id, -100, "market_buy")),
      ),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    expect(fulfilled).toHaveLength(10);
    expect(rejected).toHaveLength(10);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(TypedError);
      expect((r.reason as TypedError).code).toBe("INSUFFICIENT_FUNDS");
    }

    const [character] = await t.db
      .select()
      .from(characters)
      .where(eq(characters.id, id));
    expect(character.shards).toBe(0);

    const rows = await t.db.select().from(ledger).where(eq(ledger.characterId, id));
    expect(rows).toHaveLength(10);
  });
});

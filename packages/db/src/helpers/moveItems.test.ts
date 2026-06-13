import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TypedError } from "../errors";
import { inventorySlots } from "../schema";
import { seedCharacter, seedItemDef, seedSlot } from "../test-utils";
import { createTestDb, type TestDb } from "../testing";
import { moveItems } from "./moveItems";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.cleanup();
});

function slotsOf(characterId: string, container = "backpack") {
  return t.db
    .select()
    .from(inventorySlots)
    .where(
      and(
        eq(inventorySlots.characterId, characterId),
        eq(inventorySlots.container, container),
      ),
    )
    .orderBy(inventorySlots.slot);
}

describe("moveItems", () => {
  it("merges into existing stacks then splits overflow, respecting stack_max", async () => {
    const id = await seedCharacter(t.db);
    await seedItemDef(t.db, "widget", 64);
    await seedSlot(t.db, id, 0, "widget", 60);

    await t.db.transaction((tx) =>
      moveItems(tx, [{ characterId: id, itemId: "widget", qty: 70 }]),
    );

    const slots = await slotsOf(id);
    expect(slots.map((s) => [s.slot, s.qty])).toEqual([
      [0, 64],
      [1, 64],
      [2, 2],
    ]);
    expect(slots.every((s) => s.qty > 0)).toBe(true);
  });

  it("concurrent: two parallel removals of the last item → one wins, one throws, no zero rows", async () => {
    const id = await seedCharacter(t.db);
    await seedItemDef(t.db, "relic", 1);
    await seedSlot(t.db, id, 0, "relic", 1);

    const results = await Promise.allSettled([
      t.db.transaction((tx) =>
        moveItems(tx, [{ characterId: id, itemId: "relic", qty: -1 }]),
      ),
      t.db.transaction((tx) =>
        moveItems(tx, [{ characterId: id, itemId: "relic", qty: -1 }]),
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0].reason as TypedError).code).toBe("INSUFFICIENT_ITEMS");

    const slots = await slotsOf(id);
    expect(slots).toHaveLength(0);
  });

  it("all-or-nothing: a failing op leaves earlier ops in the list unapplied", async () => {
    const id = await seedCharacter(t.db);
    await seedItemDef(t.db, "plank", 999);
    await seedSlot(t.db, id, 0, "plank", 5);

    await expect(
      t.db.transaction((tx) =>
        moveItems(tx, [
          { characterId: id, itemId: "plank", qty: -5 }, // would empty the stack
          { characterId: id, itemId: "ghost", qty: -1 }, // unknown item → throws
        ]),
      ),
    ).rejects.toBeInstanceOf(TypedError);

    const slots = await slotsOf(id);
    expect(slots.map((s) => [s.itemId, s.qty])).toEqual([["plank", 5]]);
  });

  it("lock ordering: opposite-order ops on the same slots never deadlock (50x)", async () => {
    const id = await seedCharacter(t.db);
    await seedItemDef(t.db, "ore_a", 9999);
    await seedItemDef(t.db, "ore_b", 9999);
    await seedSlot(t.db, id, 0, "ore_a", 1);
    await seedSlot(t.db, id, 1, "ore_b", 1);

    for (let i = 0; i < 50; i++) {
      await Promise.all([
        t.db.transaction((tx) =>
          moveItems(tx, [
            { characterId: id, itemId: "ore_a", qty: 1 },
            { characterId: id, itemId: "ore_b", qty: 1 },
          ]),
        ),
        t.db.transaction((tx) =>
          moveItems(tx, [
            { characterId: id, itemId: "ore_b", qty: 1 },
            { characterId: id, itemId: "ore_a", qty: 1 },
          ]),
        ),
      ]);
    }

    const slots = await slotsOf(id);
    const oreA = slots.find((s) => s.itemId === "ore_a");
    const oreB = slots.find((s) => s.itemId === "ore_b");
    expect(oreA?.qty).toBe(101); // 1 + (2 per iteration * 50)
    expect(oreB?.qty).toBe(101);
  });
});

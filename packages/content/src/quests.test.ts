import { describe, expect, it } from "vitest";

import { ITEMS } from "./items";
import {
  applyEvent,
  DAILY_QUESTS,
  FIRST_QUEST,
  gameDay,
  GAME_DAY_MS,
  objectiveProgress,
  QUEST_BY_ID,
  QUESTS,
  questComplete,
  STORY_QUESTS,
} from "./quests";
import { validateQuests } from "./validate";

describe("quest content", () => {
  it("validates clean (items + unlocks resolve)", () => {
    expect(validateQuests(QUESTS, ITEMS)).toEqual([]);
  });

  it("the story chain links q1 → … → q5 and the first quest is q1", () => {
    expect(FIRST_QUEST).toBe("q1_claim");
    const chain: string[] = [];
    let id: string | undefined = FIRST_QUEST;
    while (id) {
      chain.push(id);
      id = QUEST_BY_ID[id].unlocks;
    }
    expect(chain).toEqual(["q1_claim", "q2_timber", "q3_foundations", "q4_house", "q5_skyline"]);
    expect(STORY_QUESTS.map((q) => q.id)).toEqual(chain);
    expect(DAILY_QUESTS.every((q) => q.repeatable)).toBe(true);
  });
});

describe("quest engine (pure)", () => {
  it("gather advances only the matching item and caps at target", () => {
    const q = QUEST_BY_ID.q2_timber; // gather 20 wood
    let obj = applyEvent(q, {}, { type: "gather", item: "stone", qty: 5 });
    expect(obj).toEqual({}); // wrong item — no progress
    obj = applyEvent(q, obj, { type: "gather", item: "wood", qty: 12 });
    expect(obj["0"]).toBe(12);
    expect(questComplete(q, obj)).toBe(false);
    obj = applyEvent(q, obj, { type: "gather", item: "wood", qty: 50 });
    expect(obj["0"]).toBe(20); // capped
    expect(questComplete(q, obj)).toBe(true);
  });

  it("claim_plot and place_structure are count objectives", () => {
    expect(questComplete(QUEST_BY_ID.q1_claim, applyEvent(QUEST_BY_ID.q1_claim, {}, { type: "claim_plot" }))).toBe(true);
    const built = applyEvent(QUEST_BY_ID.q3_foundations, {}, { type: "place_structure", defId: "hut" });
    expect(questComplete(QUEST_BY_ID.q3_foundations, built)).toBe(true);
  });

  it("upgrade_structure tracks the highest tier reached", () => {
    const q4 = QUEST_BY_ID.q4_house; // tier 3
    const q5 = QUEST_BY_ID.q5_skyline; // tier 6
    let p4: Record<string, number> = {};
    let p5: Record<string, number> = {};
    for (const tier of [2, 3, 4, 6]) {
      p4 = applyEvent(q4, p4, { type: "upgrade_structure", tier });
      p5 = applyEvent(q5, p5, { type: "upgrade_structure", tier });
    }
    expect(p4["0"]).toBe(3); // capped at target 3
    expect(questComplete(q4, p4)).toBe(true);
    expect(p5["0"]).toBe(6);
    expect(questComplete(q5, p5)).toBe(true);
  });

  it("objectiveProgress ignores unrelated events", () => {
    const obj = { type: "gather", target: 5, item: "wood", label: "x" } as const;
    expect(objectiveProgress(obj, 2, { type: "claim_plot" })).toBe(2);
  });

  it("gameDay increments once per in-game day", () => {
    expect(gameDay(0, 1)).toBe(0);
    expect(gameDay(GAME_DAY_MS - 1, 1)).toBe(0);
    expect(gameDay(GAME_DAY_MS, 1)).toBe(1);
    // 8× clock → a game-day passes in ⅛ the real time
    expect(gameDay(GAME_DAY_MS / 8, 8)).toBe(1);
  });
});

import {
  applyEvent,
  DAILY_QUESTS,
  FIRST_QUEST,
  QUEST_BY_ID,
  type QuestEvent,
  type QuestReward,
  questComplete,
  STORY_QUESTS,
} from "@crypto-valley/content";
import { and, eq } from "drizzle-orm";

import type { Tx } from "../client";
import { TypedError } from "../errors";
import { questProgress } from "../schema";
import { moveItems } from "./moveItems";
import { moveShards } from "./moveShards";

const STORY_IDS = new Set(STORY_QUESTS.map((q) => q.id));

async function assign(tx: Tx, characterId: string, questId: string, day: number | null): Promise<void> {
  await tx
    .insert(questProgress)
    .values({ characterId, questId, status: "active", objectives: {}, day })
    .onConflictDoNothing();
}

/**
 * Make sure the player has their onboarding quest + today's dailies. Idempotent:
 *  - assigns the FIRST story quest if the player has no story quest yet;
 *  - assigns each daily if missing, and RESETS any daily stamped with an older
 *    game-day back to active with cleared progress.
 * Steady state (same day, all assigned) does only a read.
 */
export async function ensureQuests(tx: Tx, characterId: string, day: number): Promise<void> {
  const rows = await tx.select().from(questProgress).where(eq(questProgress.characterId, characterId));
  const byId = new Map(rows.map((r) => [r.questId, r]));

  if (!rows.some((r) => STORY_IDS.has(r.questId))) {
    await assign(tx, characterId, FIRST_QUEST, null);
  }
  for (const d of DAILY_QUESTS) {
    const row = byId.get(d.id);
    if (!row) {
      await assign(tx, characterId, d.id, day);
    } else if (row.day !== day) {
      await tx
        .update(questProgress)
        .set({ status: "active", objectives: {}, day, acceptedAt: new Date() })
        .where(and(eq(questProgress.characterId, characterId), eq(questProgress.questId, d.id)));
    }
  }
}

/**
 * Advance the player's ACTIVE quests against a domain event, IN the action's
 * transaction (no polling race). Auto-assigns first so a brand-new player's very
 * first action already counts. Returns the ids of quests that just completed.
 */
export async function advanceQuests(
  tx: Tx,
  characterId: string,
  ev: QuestEvent,
  day: number,
): Promise<string[]> {
  await ensureQuests(tx, characterId, day);
  const rows = await tx
    .select()
    .from(questProgress)
    .where(and(eq(questProgress.characterId, characterId), eq(questProgress.status, "active")));

  const completed: string[] = [];
  for (const row of rows) {
    const def = QUEST_BY_ID[row.questId];
    if (!def) continue;
    const before = (row.objectives ?? {}) as Record<string, number>;
    const after = applyEvent(def, before, ev);
    const done = questComplete(def, after);
    if (done || JSON.stringify(after) !== JSON.stringify(before)) {
      await tx
        .update(questProgress)
        .set({ objectives: after, status: done ? "complete" : "active" })
        .where(and(eq(questProgress.characterId, characterId), eq(questProgress.questId, row.questId)));
      if (done) completed.push(row.questId);
    }
  }
  return completed;
}

/**
 * Claim a COMPLETED quest's reward (Shards + items, ledgered) exactly once, then
 * unlock the next story quest. The row is locked + status-checked so a quest can't
 * be claimed twice or while incomplete.
 *
 * @throws TypedError `QUEST_NOT_FOUND` | `QUEST_INCOMPLETE` | `QUEST_ALREADY_CLAIMED`
 */
export async function claimQuest(
  tx: Tx,
  characterId: string,
  questId: string,
): Promise<QuestReward> {
  const [row] = await tx
    .select()
    .from(questProgress)
    .where(and(eq(questProgress.characterId, characterId), eq(questProgress.questId, questId)))
    .for("update");
  if (!row) throw new TypedError("QUEST_NOT_FOUND", `no quest ${questId}`);
  if (row.status === "claimed") throw new TypedError("QUEST_ALREADY_CLAIMED", "already claimed");
  if (row.status !== "complete") throw new TypedError("QUEST_INCOMPLETE", "quest not complete");

  const def = QUEST_BY_ID[questId];
  if (!def) throw new TypedError("QUEST_NOT_FOUND", `unknown quest ${questId}`);

  if (def.reward.shards > 0) {
    await moveShards(tx, characterId, def.reward.shards, "quest_reward");
  }
  if (def.reward.items?.length) {
    await moveItems(
      tx,
      def.reward.items.map((r) => ({ characterId, itemId: r.item, qty: r.qty })),
    );
  }

  await tx
    .update(questProgress)
    .set({ status: "claimed" })
    .where(and(eq(questProgress.characterId, characterId), eq(questProgress.questId, questId)));

  if (def.unlocks) await assign(tx, characterId, def.unlocks, null);

  return def.reward;
}

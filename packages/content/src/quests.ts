/**
 * Quests — GAME DATA AS CODE + the pure engine core (P8).
 *
 * Quests are the new-player on-ramp and the core earn driver: a story chain that
 * teaches claim → gather → build → upgrade, plus repeatable dailies. The engine
 * is event-sourced — every successful action emits a `QuestEvent`, and these PURE
 * functions advance objectives. The DB helper (packages/db) persists progress and
 * grants rewards (via the ledgered moveShards/moveItems) only on claim.
 */

export type ObjectiveType =
  | "gather"
  | "harvest"
  | "claim_plot"
  | "place_structure"
  | "upgrade_structure"
  | "reach_shards";

export interface QuestObjective {
  type: ObjectiveType;
  target: number;
  /** gather: item id (wood/stone). harvest: optional crop filter (else any). */
  item?: string;
  /** place_structure: optional def filter (else any structure). */
  defId?: string;
  /** Short label for the progress bar. */
  label: string;
}

export interface QuestRewardItem {
  item: string;
  qty: number;
}
export interface QuestReward {
  shards: number;
  items?: QuestRewardItem[];
  /** A cosmetic/title flag granted on claim (display-only at MVP). */
  flag?: string;
}

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  objectives: QuestObjective[];
  reward: QuestReward;
  /** Story quest unlocked when THIS one is claimed. */
  unlocks?: string;
  /** Daily/repeatable — resets each game-day. */
  repeatable?: boolean;
  /** Story display order. */
  order?: number;
}

/** A typed domain event emitted by a successful action; the engine matches it. */
export interface QuestEvent {
  type: "gather" | "harvest" | "claim_plot" | "place_structure" | "upgrade_structure";
  /** gather/harvest item id. */
  item?: string;
  /** gather/harvest amount. */
  qty?: number;
  /** place_structure def id. */
  defId?: string;
  /** upgrade_structure: the tier the structure REACHED. */
  tier?: number;
}

/** The onboarding STORY CHAIN (each unlocks the next) + repeatable DAILIES. */
export const QUESTS: readonly QuestDef[] = [
  {
    id: "q1_claim",
    title: "Stake Your Claim",
    description: "Every builder needs land. Walk onto an empty plot and claim it.",
    objectives: [{ type: "claim_plot", target: 1, label: "Claim a plot" }],
    reward: { shards: 50, items: [{ item: "wood", qty: 20 }] },
    unlocks: "q2_timber",
    order: 1,
  },
  {
    id: "q2_timber",
    title: "Timber",
    description: "Wood builds everything. Chop trees around the island.",
    objectives: [{ type: "gather", item: "wood", target: 20, label: "Gather wood" }],
    reward: { shards: 30, items: [{ item: "stone", qty: 10 }] },
    unlocks: "q3_foundations",
    order: 2,
  },
  {
    id: "q3_foundations",
    title: "First Foundations",
    description: "Open the build menu on your plot and place your first structure.",
    objectives: [{ type: "place_structure", target: 1, label: "Place a structure" }],
    reward: { shards: 60 },
    unlocks: "q4_house",
    order: 3,
  },
  {
    id: "q4_house",
    title: "Reach for the Sky",
    description: "Grow a structure up the chain to a House (tier 3).",
    objectives: [{ type: "upgrade_structure", target: 3, label: "Upgrade to House (tier 3)" }],
    reward: { shards: 100, items: [{ item: "stone", qty: 20 }] },
    unlocks: "q5_skyline",
    order: 4,
  },
  {
    id: "q5_skyline",
    title: "Rising Skyline",
    description: "Raise a tower all the way to a Skyscraper (tier 6).",
    objectives: [{ type: "upgrade_structure", target: 6, label: "Raise a Skyscraper (tier 6)" }],
    reward: { shards: 250, flag: "skyline_master" },
    order: 5,
  },
  // ---- repeatable dailies ----------------------------------------------------
  {
    id: "daily_wood",
    title: "Daily: Lumberjack",
    description: "Bring in a day's worth of wood.",
    objectives: [{ type: "gather", item: "wood", target: 30, label: "Gather wood" }],
    reward: { shards: 40 },
    repeatable: true,
  },
  {
    id: "daily_harvest",
    title: "Daily: Harvest",
    description: "Work the farm and harvest crops.",
    objectives: [{ type: "harvest", target: 10, label: "Harvest crops" }],
    reward: { shards: 40 },
    repeatable: true,
  },
  {
    id: "daily_build",
    title: "Daily: Developer",
    description: "Keep the skyline growing — place new structures.",
    objectives: [{ type: "place_structure", target: 2, label: "Place structures" }],
    reward: { shards: 50 },
    repeatable: true,
  },
] as const;

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(
  QUESTS.map((q) => [q.id, q]),
);
export const STORY_QUESTS: readonly QuestDef[] = QUESTS.filter((q) => !q.repeatable).sort(
  (a, b) => (a.order ?? 0) - (b.order ?? 0),
);
export const DAILY_QUESTS: readonly QuestDef[] = QUESTS.filter((q) => q.repeatable);
/** Auto-assigned on character creation. */
export const FIRST_QUEST = "q1_claim";

// ============================================================ pure engine core
/** Progress for one objective after an event, capped at its target. */
export function objectiveProgress(obj: QuestObjective, current: number, ev: QuestEvent): number {
  const cap = (n: number): number => Math.min(obj.target, n);
  switch (obj.type) {
    case "gather":
      return ev.type === "gather" && (!obj.item || obj.item === ev.item)
        ? cap(current + (ev.qty ?? 0))
        : current;
    case "harvest":
      return ev.type === "harvest" && (!obj.item || obj.item === ev.item)
        ? cap(current + (ev.qty ?? 0))
        : current;
    case "claim_plot":
      return ev.type === "claim_plot" ? cap(current + 1) : current;
    case "place_structure":
      return ev.type === "place_structure" && (!obj.defId || obj.defId === ev.defId)
        ? cap(current + 1)
        : current;
    case "upgrade_structure":
      return ev.type === "upgrade_structure" ? cap(Math.max(current, ev.tier ?? 0)) : current;
    case "reach_shards":
      return current; // resolved from balance on read, not from events
  }
}

/** Apply an event to a quest's objective-progress map; returns a NEW map. */
export function applyEvent(
  quest: QuestDef,
  objectives: Record<string, number>,
  ev: QuestEvent,
): Record<string, number> {
  const next: Record<string, number> = { ...objectives };
  quest.objectives.forEach((obj, i) => {
    const cur = next[String(i)] ?? 0;
    const np = objectiveProgress(obj, cur, ev);
    if (np !== cur) next[String(i)] = np;
  });
  return next;
}

/** True when every objective has met its target (`shards` resolves reach_shards). */
export function questComplete(
  quest: QuestDef,
  objectives: Record<string, number>,
  shards = 0,
): boolean {
  return quest.objectives.every((obj, i) =>
    obj.type === "reach_shards" ? shards >= obj.target : (objectives[String(i)] ?? 0) >= obj.target,
  );
}

/** One in-game day in game-ms (1440 game-minutes). */
export const GAME_DAY_MS = 24 * 60 * 60 * 1000;
/** Game-day index — pure (real time + clock factor are parameters). */
export function gameDay(nowMs: number, clockFactor: number): number {
  return Math.floor((nowMs * clockFactor) / GAME_DAY_MS);
}

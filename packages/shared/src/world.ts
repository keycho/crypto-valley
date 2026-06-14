import { z } from "zod";

/**
 * Town/world HTTP contract (P6, reworked in P7). A claimed plot is a CANVAS;
 * what's built on it is a free-form list of `structures` (hut → skyscraper chain
 * + standalones), NOT a per-plot tier. Every body is Zod-validated at the API
 * boundary; structure defs/costs/footprints live in packages/content, the wire
 * carries only ids + positions + the current tier so the client renders + checks
 * affordability.
 */

export const PlotViewSchema = z.object({
  index: z.number().int(),
  /** null = unclaimed. */
  ownerId: z.string().nullable(),
  ownerName: z.string().nullable(),
  /** Footprint in tiles. */
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int(),
  h: z.number().int(),
  /** Active land-market listing price (null = not for sale). */
  price: z.number().int().nullable(),
  /** Listing currency ("shards" for now). */
  currency: z.string().nullable(),
});
export type PlotView = z.infer<typeof PlotViewSchema>;

/** A placed structure (P7). `defId` keys the content catalog; `tier` is its level. */
export const StructureViewSchema = z.object({
  id: z.string(),
  /** Content index of the plot it sits on. */
  plotIndex: z.number().int(),
  defId: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int(),
  h: z.number().int(),
  rotation: z.number().int(),
  tier: z.number().int(),
});
export type StructureView = z.infer<typeof StructureViewSchema>;

export const GatherKindSchema = z.enum(["tree", "rock"]);
export type GatherKind = z.infer<typeof GatherKindSchema>;

export const NodeViewSchema = z.object({
  id: z.string(),
  kind: GatherKindSchema,
  x: z.number().int(),
  y: z.number().int(),
  /** false = harvested, waiting to respawn (rendered as a stump/rubble). */
  available: z.boolean(),
});
export type NodeView = z.infer<typeof NodeViewSchema>;

/** The requesting player's own counters, for affordability + the HUD. */
export const MeViewSchema = z.object({
  shards: z.number().int(),
  energy: z.number().int(),
  energyMax: z.number().int(),
  wood: z.number().int(),
  stone: z.number().int(),
  /** Plot indices this player owns (P9 — may own several). */
  ownedPlots: z.array(z.number().int()),
  /** Portfolio cap. */
  maxPlots: z.number().int(),
});
export type MeView = z.infer<typeof MeViewSchema>;

/** A quest as the client renders it (progress + reward), computed server-side. */
export const QuestObjectiveViewSchema = z.object({
  label: z.string(),
  progress: z.number().int(),
  target: z.number().int(),
});
export const QuestViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["active", "complete", "claimed"]),
  repeatable: z.boolean(),
  order: z.number().int().optional(),
  objectives: z.array(QuestObjectiveViewSchema),
  reward: z.object({
    shards: z.number().int(),
    items: z.array(z.object({ item: z.string(), qty: z.number().int() })),
    flag: z.string().optional(),
  }),
});
export type QuestView = z.infer<typeof QuestViewSchema>;

// ---- seasons / leaderboard (P10) -------------------------------------------
export const SeasonBoardEntrySchema = z.object({
  characterId: z.string(),
  name: z.string(),
  score: z.number().int(),
  rank: z.number().int(),
});
export type SeasonBoardEntry = z.infer<typeof SeasonBoardEntrySchema>;

export const SeasonTrophySchema = z.object({
  seasonNumber: z.number().int(),
  board: z.string(),
  rank: z.number().int(),
  prize: z.number().int(),
});
export type SeasonTrophy = z.infer<typeof SeasonTrophySchema>;

export const SeasonViewSchema = z.object({
  number: z.number().int(),
  /** ms-epoch the season ends (client renders the countdown). */
  endsAt: z.number().int(),
  pool: z.number().int(),
  profitBoard: z.array(SeasonBoardEntrySchema),
  portfolioBoard: z.array(SeasonBoardEntrySchema),
  me: z.object({
    profit: z.number().int(),
    portfolioValue: z.number().int(),
    profitRank: z.number().int().nullable(),
    portfolioRank: z.number().int().nullable(),
  }),
  trophies: z.array(SeasonTrophySchema),
});
export type SeasonView = z.infer<typeof SeasonViewSchema>;

export const WorldStateSchema = z.object({
  plots: z.array(PlotViewSchema),
  structures: z.array(StructureViewSchema),
  nodes: z.array(NodeViewSchema),
  quests: z.array(QuestViewSchema),
  season: SeasonViewSchema,
  me: MeViewSchema,
});
export type WorldState = z.infer<typeof WorldStateSchema>;

// ---- POST /world/act : a discriminated union over the action ----------------
const uuid = z.string().uuid();

/** Claim the unclaimed plot the player is standing on. */
export const ClaimActionSchema = z.object({
  action: z.literal("claim"),
  characterId: uuid,
  plotIndex: z.number().int(),
  posX: z.number().int(),
  posY: z.number().int(),
});
/** Chop a tree (→wood) the player is adjacent to. */
export const ChopActionSchema = z.object({
  action: z.literal("chop"),
  characterId: uuid,
  nodeId: z.string().max(32),
  posX: z.number().int(),
  posY: z.number().int(),
});
/** Mine a rock (→stone) the player is adjacent to. */
export const MineActionSchema = z.object({
  action: z.literal("mine"),
  characterId: uuid,
  nodeId: z.string().max(32),
  posX: z.number().int(),
  posY: z.number().int(),
});
/** Place a structure on your owned plot (free-form, top-left tile = x,y). */
export const PlaceActionSchema = z.object({
  action: z.literal("place"),
  characterId: uuid,
  defId: z.string().max(32),
  x: z.number().int(),
  y: z.number().int(),
  rotation: z.number().int().min(0).max(3).default(0),
});
/** Upgrade one of your structures to its next chain tier (in place). */
export const UpgradeActionSchema = z.object({
  action: z.literal("upgrade"),
  characterId: uuid,
  structureId: uuid,
});
/** Remove one of your structures for a partial refund. */
export const RemoveActionSchema = z.object({
  action: z.literal("remove"),
  characterId: uuid,
  structureId: uuid,
});
/** Claim a completed quest's reward (Shards + items, ledgered, once). */
export const ClaimQuestActionSchema = z.object({
  action: z.literal("claimQuest"),
  characterId: uuid,
  questId: z.string().max(40),
});
/** List one of your plots on the land market at `price`. */
export const ListPlotActionSchema = z.object({
  action: z.literal("listPlot"),
  characterId: uuid,
  plotIndex: z.number().int(),
  price: z.number().int().positive(),
  currency: z.string().max(16).default("shards"),
});
/** Cancel your active listing on a plot. */
export const UnlistPlotActionSchema = z.object({
  action: z.literal("unlistPlot"),
  characterId: uuid,
  plotIndex: z.number().int(),
});
/** Buy a listed plot (Shards buyer→seller, ownership transfers). */
export const BuyPlotActionSchema = z.object({
  action: z.literal("buyPlot"),
  characterId: uuid,
  plotIndex: z.number().int(),
});

export const WorldActionSchema = z.discriminatedUnion("action", [
  ClaimActionSchema,
  ChopActionSchema,
  MineActionSchema,
  PlaceActionSchema,
  UpgradeActionSchema,
  RemoveActionSchema,
  ClaimQuestActionSchema,
  ListPlotActionSchema,
  UnlistPlotActionSchema,
  BuyPlotActionSchema,
]);
export type WorldAction = z.infer<typeof WorldActionSchema>;

export const WorldActionResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  toast: z.string().optional(),
  state: WorldStateSchema.optional(),
});
export type WorldActionResult = z.infer<typeof WorldActionResultSchema>;

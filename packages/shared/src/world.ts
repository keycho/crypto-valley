import { z } from "zod";

/**
 * Town/world HTTP contract (P6): claimable plots + gathering nodes. Every body
 * is Zod-validated at the API boundary. Tier names/costs live in
 * packages/content; the wire only carries the tier *number* + ownership so the
 * client renders the right building and affordability.
 */

export const PlotViewSchema = z.object({
  index: z.number().int(),
  tier: z.number().int(),
  /** null = unclaimed. */
  ownerId: z.string().nullable(),
  ownerName: z.string().nullable(),
  /** Footprint in tiles. */
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int(),
  h: z.number().int(),
});
export type PlotView = z.infer<typeof PlotViewSchema>;

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
  /** Index of the plot this player owns, or null. */
  ownedPlot: z.number().int().nullable(),
});
export type MeView = z.infer<typeof MeViewSchema>;

export const WorldStateSchema = z.object({
  plots: z.array(PlotViewSchema),
  nodes: z.array(NodeViewSchema),
  me: MeViewSchema,
});
export type WorldState = z.infer<typeof WorldStateSchema>;

export const WorldActionKindSchema = z.enum(["claim", "upgrade", "chop", "mine"]);
export type WorldActionKind = z.infer<typeof WorldActionKindSchema>;

/** POST /world/act body. posX/posY are the actor's tile coords (range check). */
export const WorldActionSchema = z.object({
  characterId: z.string().uuid(),
  action: WorldActionKindSchema,
  /** Required for claim/upgrade. */
  plotIndex: z.number().int().optional(),
  /** Required for chop/mine. */
  nodeId: z.string().max(32).optional(),
  posX: z.number().int(),
  posY: z.number().int(),
});
export type WorldAction = z.infer<typeof WorldActionSchema>;

export const WorldActionResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  toast: z.string().optional(),
  state: WorldStateSchema.optional(),
});
export type WorldActionResult = z.infer<typeof WorldActionResultSchema>;

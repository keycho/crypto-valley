import { z } from "zod";

/** Farm tile zones the player can act on. Soil states stored in `farm_tiles`. */
export const TileStateSchema = z.enum(["tilled", "watered"]);
export type TileState = z.infer<typeof TileStateSchema>;

export const FarmActionKindSchema = z.enum(["hoe", "water", "plant", "harvest"]);
export type FarmActionKind = z.infer<typeof FarmActionKindSchema>;

/** POST /farm/act body. posX/posY are the actor's tile coords (range check). */
export const FarmActionSchema = z.object({
  characterId: z.string().uuid(),
  action: FarmActionKindSchema,
  x: z.number().int(),
  y: z.number().int(),
  posX: z.number().int(),
  posY: z.number().int(),
  itemId: z.string().optional(),
});
export type FarmAction = z.infer<typeof FarmActionSchema>;

export const TileViewSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  state: TileStateSchema,
  watered: z.boolean(),
});
export type TileView = z.infer<typeof TileViewSchema>;

export const CropViewSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  cropId: z.string(),
  stage: z.number().int(),
  stages: z.number().int(),
  ready: z.boolean(),
  dead: z.boolean(),
  watered: z.boolean(),
});
export type CropViewDto = z.infer<typeof CropViewSchema>;

export const InvSlotSchema = z.object({
  container: z.string(),
  slot: z.number().int(),
  itemId: z.string(),
  qty: z.number().int(),
});
export type InvSlot = z.infer<typeof InvSlotSchema>;

export const CharacterViewSchema = z.object({
  id: z.string(),
  energy: z.number().int(),
  energyMax: z.number().int(),
  shards: z.number().int(),
  farmingXp: z.number().int(),
});
export type CharacterView = z.infer<typeof CharacterViewSchema>;

export const FarmStateSchema = z.object({
  character: CharacterViewSchema,
  tiles: z.array(TileViewSchema),
  crops: z.array(CropViewSchema),
  inventory: z.array(InvSlotSchema),
});
export type FarmState = z.infer<typeof FarmStateSchema>;

export const ActionResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  state: FarmStateSchema.optional(),
  /** Toast hint for the client (e.g. "+2 Bitberry", "+12 Farming"). */
  toast: z.string().optional(),
});
export type ActionResult = z.infer<typeof ActionResultSchema>;

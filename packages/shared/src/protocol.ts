import { decode, encode } from "@msgpack/msgpack";
import { z } from "zod";

/** Bumped on any wire-format change; the server rejects mismatched joins. */
export const PROTOCOL_VERSION = 1;

/** Premade LimeZu character sheets offered at character creation. */
export const CHARACTER_SHEETS = ["adam", "alex", "amelia", "bob"] as const;
export type CharacterSheet = (typeof CHARACTER_SHEETS)[number];

export const AppearanceSchema = z.object({ sheet: z.enum(CHARACTER_SHEETS) });
export type Appearance = z.infer<typeof AppearanceSchema>;

export const DirSchema = z.enum(["right", "up", "left", "down"]);
export type Dir = z.infer<typeof DirSchema>;

export const MAX_CHAT_LEN = 200;

// ============================================================ Client -> Server
export const JoinSchema = z.object({
  t: z.literal("join"),
  v: z.number().int(),
  characterId: z.string().min(1).max(64),
  name: z.string().min(1).max(16),
  appearance: AppearanceSchema,
});
export const MoveSchema = z.object({
  t: z.literal("move"),
  seq: z.number().int().nonnegative(),
  x: z.number().finite(),
  y: z.number().finite(),
  dir: DirSchema,
  moving: z.boolean(),
});
export const ChatC2SSchema = z.object({ t: z.literal("chat"), msg: z.string().min(1).max(MAX_CHAT_LEN) });
export const EmoteC2SSchema = z.object({ t: z.literal("emote"), id: z.string().min(1).max(16) });

export const C2SSchema = z.discriminatedUnion("t", [
  JoinSchema,
  MoveSchema,
  ChatC2SSchema,
  EmoteC2SSchema,
]);
export type C2S = z.infer<typeof C2SSchema>;

// ============================================================ Server -> Client
export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  appearance: AppearanceSchema,
  x: z.number(),
  y: z.number(),
  dir: DirSchema,
  moving: z.boolean(),
});
export type PlayerDto = z.infer<typeof PlayerSchema>;

export const SnapEntrySchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  dir: DirSchema,
  moving: z.boolean(),
});
export type SnapEntry = z.infer<typeof SnapEntrySchema>;

export const WelcomeSchema = z.object({
  t: z.literal("welcome"),
  v: z.number().int(),
  youId: z.string(),
  tick: z.number().int(),
  players: z.array(PlayerSchema),
});
export const SnapshotSchema = z.object({
  t: z.literal("snapshot"),
  tick: z.number().int(),
  players: z.array(SnapEntrySchema),
});
export const PlayerJoinedSchema = z.object({ t: z.literal("playerJoined"), player: PlayerSchema });
export const PlayerLeftSchema = z.object({ t: z.literal("playerLeft"), id: z.string() });
export const ChatS2CSchema = z.object({
  t: z.literal("chat"),
  fromId: z.string(),
  name: z.string(),
  msg: z.string(),
});
export const EmoteS2CSchema = z.object({ t: z.literal("emote"), id: z.string(), emote: z.string() });
export const ErrorSchema = z.object({ t: z.literal("error"), code: z.string() });

export const S2CSchema = z.discriminatedUnion("t", [
  WelcomeSchema,
  SnapshotSchema,
  PlayerJoinedSchema,
  PlayerLeftSchema,
  ChatS2CSchema,
  EmoteS2CSchema,
  ErrorSchema,
]);
export type S2C = z.infer<typeof S2CSchema>;

// ============================================================ msgpack framing
export function encodeMsg(msg: C2S | S2C): Uint8Array {
  return encode(msg);
}

const toU8 = (buf: ArrayBuffer | Uint8Array): Uint8Array =>
  buf instanceof Uint8Array ? buf : new Uint8Array(buf);

/** Decode + validate a client message; returns null for anything malformed. */
export function decodeC2S(buf: ArrayBuffer | Uint8Array): C2S | null {
  try {
    return C2SSchema.parse(decode(toU8(buf)));
  } catch {
    return null;
  }
}

/** Decode + validate a server message; returns null for anything malformed. */
export function decodeS2C(buf: ArrayBuffer | Uint8Array): S2C | null {
  try {
    return S2CSchema.parse(decode(toU8(buf)));
  } catch {
    return null;
  }
}

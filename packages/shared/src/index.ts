import { z } from "zod";

/**
 * Placeholder protocol schema.
 *
 * The full client/server protocol (move/snap/chat/...) is defined in this package
 * in a later milestone. For now the ping/pong pair proves that cross-package zod
 * schemas and types flow into apps/game-server.
 */
export const PingMessageSchema = z.object({
  t: z.literal("ping"),
});
export type PingMessage = z.infer<typeof PingMessageSchema>;

export const PongMessageSchema = z.object({
  t: z.literal("pong"),
});
export type PongMessage = z.infer<typeof PongMessageSchema>;

/** Build the pong reply for a validated ping. */
export function makePong(): PongMessage {
  return { t: "pong" };
}

export * from "./farm";
export * from "./protocol";
export * from "./collision";

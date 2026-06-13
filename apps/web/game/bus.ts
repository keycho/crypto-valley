import mitt from "mitt";

/**
 * Typed event bus between the Phaser world and the React HUD.
 * Phaser emits; React subscribes (see hud/HudBridge.tsx). Per CLAUDE.md the
 * client is a renderer — nothing crossing this bus may mutate game state.
 */
export type GameEvents = {
  /** Fake in-game clock tick (1 game minute per real second). */
  clock: { minutesOfDay: number };
  /** Renderer frames-per-second sample, ~2x per second. */
  fps: { fps: number };
  /** React chat input -> game server (relayed to the town). */
  chatSend: { msg: string };
};

export const gameBus = mitt<GameEvents>();

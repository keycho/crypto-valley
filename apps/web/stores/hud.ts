import { create } from "zustand";

import { CLOCK_START_MINUTES } from "../game/constants";

/**
 * HUD state mirrored FROM the game via the event bus. Display-only: per
 * CLAUDE.md the client never mutates game state, so this store has no
 * gameplay setters — only sinks for bus events.
 */
interface HudState {
  minutesOfDay: number;
  fps: number;
  setMinutesOfDay: (m: number) => void;
  setFps: (f: number) => void;
}

export const useHudStore = create<HudState>((set) => ({
  minutesOfDay: CLOCK_START_MINUTES,
  fps: 0,
  setMinutesOfDay: (minutesOfDay) => set({ minutesOfDay }),
  setFps: (fps) => set({ fps }),
}));

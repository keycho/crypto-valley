import { create } from "zustand";

/** Leaderboard panel open/closed (season data lives in the world store). */
interface SeasonUiStore {
  open: boolean;
  toggle: () => void;
  set: (open: boolean) => void;
}

export const useSeasonUi = create<SeasonUiStore>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  set: (open) => set({ open }),
}));

import { create } from "zustand";

/** Quest-log open/closed (HUD-only UI state; quest data lives in the world store). */
interface QuestUiStore {
  open: boolean;
  toggle: () => void;
  set: (open: boolean) => void;
}

export const useQuestUi = create<QuestUiStore>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  set: (open) => set({ open }),
}));

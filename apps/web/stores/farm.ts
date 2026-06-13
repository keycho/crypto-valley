import { create } from "zustand";

import type { FarmState } from "@crypto-valley/shared";

export type Zone = "town" | "farm";

/**
 * Shared single source of truth between Phaser (writes via getState().patch)
 * and the React HUD (reads via the hook). All gameplay state is server-owned;
 * this just mirrors the latest /farm/state for display + input intent.
 */
interface FarmStore {
  characterId: string | null;
  farm: FarmState | null;
  zone: Zone;
  selectedSlot: number;
  inventoryOpen: boolean;
  toast: string | null;
  /** Bumped on every notify() so repeated identical messages still surface. */
  toastSeq: number;
  patch: (p: Partial<Omit<FarmStore, "patch" | "notify">>) => void;
  notify: (msg: string) => void;
}

export const useFarmStore = create<FarmStore>((set) => ({
  characterId: null,
  farm: null,
  zone: "town",
  selectedSlot: 0,
  inventoryOpen: false,
  toast: null,
  toastSeq: 0,
  patch: (p) => set(p),
  notify: (msg) => set((s) => ({ toast: msg, toastSeq: s.toastSeq + 1 })),
}));

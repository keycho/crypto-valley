import { create } from "zustand";

/**
 * Build-mode UI state (P7). The React HUD writes it (Build toggle, palette,
 * structure inspect); the Phaser TownController reads it each frame to drive the
 * ghost preview / placement and to know which structure is selected. All real
 * mutations still go through the server — this is pure input intent.
 */
interface BuildStore {
  /** Build mode on → a ghost follows the cursor and clicks place. */
  buildMode: boolean;
  /** Palette selection: which structure def to place (build mode). */
  selectedDef: string | null;
  /** An existing owned structure the player clicked (to upgrade/remove). */
  selectedStructureId: string | null;
  setBuildMode: (on: boolean) => void;
  selectDef: (id: string) => void;
  selectStructure: (id: string | null) => void;
}

export const useBuildStore = create<BuildStore>((set) => ({
  buildMode: false,
  selectedDef: "hut",
  selectedStructureId: null,
  // Entering build mode clears any inspected structure; leaving clears both.
  setBuildMode: (on) => set({ buildMode: on, selectedStructureId: null }),
  selectDef: (id) => set({ selectedDef: id }),
  selectStructure: (id) => set({ selectedStructureId: id }),
}));

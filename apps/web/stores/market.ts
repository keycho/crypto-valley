import { create } from "zustand";

/**
 * Land-market HUD state (P9). The exchange board open/closed, the plot a player
 * clicked in-world to buy (shows a confirm), and which owned plot's "set price"
 * form is open. Pure UI intent — all trades go through the server.
 */
interface MarketStore {
  boardOpen: boolean;
  /** Plot index the player clicked to buy (in-world sign) → buy confirm. */
  focusBuy: number | null;
  /** Plot index whose "list for sale" price form is open. */
  listForm: number | null;
  setBoardOpen: (b: boolean) => void;
  toggleBoard: () => void;
  setFocusBuy: (i: number | null) => void;
  setListForm: (i: number | null) => void;
}

export const useMarketStore = create<MarketStore>((set) => ({
  boardOpen: false,
  focusBuy: null,
  listForm: null,
  setBoardOpen: (boardOpen) => set({ boardOpen }),
  toggleBoard: () => set((s) => ({ boardOpen: !s.boardOpen })),
  setFocusBuy: (focusBuy) => set({ focusBuy }),
  setListForm: (listForm) => set({ listForm }),
}));

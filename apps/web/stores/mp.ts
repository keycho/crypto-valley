import { create } from "zustand";

import type { Appearance } from "@crypto-valley/shared";

export interface ChatLine {
  id: number;
  from: string;
  msg: string;
}

interface MpStore {
  entered: boolean;
  name: string;
  appearance: Appearance;
  onlineCount: number;
  chat: ChatLine[];
  /** True while the chat input is focused — gates Phaser movement/hotbar keys. */
  typing: boolean;
  enter: (name: string, appearance: Appearance) => void;
  setOnline: (n: number) => void;
  pushChat: (from: string, msg: string) => void;
  setTyping: (b: boolean) => void;
}

let chatId = 0;

export const useMpStore = create<MpStore>((set) => ({
  entered: false,
  name: "",
  appearance: { sheet: "adam" },
  onlineCount: 0,
  chat: [],
  typing: false,
  enter: (name, appearance) => set({ entered: true, name, appearance }),
  setOnline: (onlineCount) => set({ onlineCount }),
  pushChat: (from, msg) =>
    set((s) => ({ chat: [...s.chat.slice(-40), { id: ++chatId, from, msg }] })),
  setTyping: (typing) => set({ typing }),
}));

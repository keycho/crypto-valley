"use client";

import { useEffect } from "react";

import { HOTBAR } from "../game/hotbar";
import { useFarmStore } from "../stores/farm";

/**
 * Hotbar number keys (1..N) + inventory toggle (I), handled in React so UI input
 * is reliable regardless of canvas focus. The Space *action* stays in Phaser.
 */
export function useHotbarKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= HOTBAR.length) {
        useFarmStore.getState().patch({ selectedSlot: n - 1 });
      } else if (e.key === "i" || e.key === "I") {
        const open = useFarmStore.getState().inventoryOpen;
        useFarmStore.getState().patch({ inventoryOpen: !open });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

import type { FarmActionKind } from "@crypto-valley/shared";

export interface HotbarSlot {
  itemId: string;
  action: FarmActionKind;
  label: string;
  icon: string;
}

/** Fixed P3 tool set; number keys 1..N select, the selected tool drives actions. */
export const HOTBAR: HotbarSlot[] = [
  { itemId: "hoe_t1", action: "hoe", label: "Hoe", icon: "⛏" },
  { itemId: "watering_can_t1", action: "water", label: "Watering Can", icon: "💧" },
  { itemId: "seed_bitberry", action: "plant", label: "Bitberry Seed", icon: "🌱" },
];

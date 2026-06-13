"use client";

import { HOTBAR } from "../game/hotbar";
import { useFarmStore } from "../stores/farm";

/** Bottom-center tool hotbar. Number keys (Phaser) or click select a slot. */
export function Hotbar() {
  const selected = useFarmStore((s) => s.selectedSlot);
  const farm = useFarmStore((s) => s.farm);
  const patch = useFarmStore((s) => s.patch);
  const qty = (id: string): number =>
    farm?.inventory.filter((i) => i.itemId === id).reduce((a, b) => a + b.qty, 0) ?? 0;

  return (
    <div style={{ display: "flex", gap: 6, pointerEvents: "auto" }}>
      {HOTBAR.map((slot, i) => {
        const on = selected === i;
        return (
          <button
            key={slot.itemId}
            onClick={() => patch({ selectedSlot: i })}
            title={slot.label}
            style={{
              width: 64,
              height: 64,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              color: "#f2e8d5",
              background: on ? "rgba(52, 211, 153, 0.18)" : "rgba(43, 34, 24, 0.82)",
              border: `2px solid ${on ? "#34d399" : "#5c4a3d"}`,
              borderRadius: 8,
              font: "inherit",
            }}
          >
            <span style={{ position: "absolute", marginTop: -44, marginLeft: -44, fontSize: 11, opacity: 0.7 }}>
              {i + 1}
            </span>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{slot.icon}</span>
            <span style={{ fontSize: 10 }}>{slot.label.split(" ")[0]}</span>
            {slot.action === "plant" ? (
              <span style={{ fontSize: 11, color: "#a7f3d0", fontVariantNumeric: "tabular-nums" }}>
                ×{qty(slot.itemId)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

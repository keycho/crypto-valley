"use client";

import { useFarmStore } from "../stores/farm";

const LABELS: Record<string, string> = {
  hoe_t1: "Hoe",
  watering_can_t1: "Watering Can",
  seed_bitberry: "Bitberry Seed",
  crop_bitberry: "Bitberry",
};

/** Backpack panel (toggle with I). Verifies harvested produce lands here. */
export function Inventory() {
  const open = useFarmStore((s) => s.inventoryOpen);
  const farm = useFarmStore((s) => s.farm);
  const patch = useFarmStore((s) => s.patch);
  if (!open || !farm) return null;

  const totals = new Map<string, number>();
  for (const s of farm.inventory) totals.set(s.itemId, (totals.get(s.itemId) ?? 0) + s.qty);
  const rows = [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div
      style={{
        pointerEvents: "auto",
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 280,
        padding: 14,
        background: "rgba(43, 34, 24, 0.96)",
        border: "1px solid #5c4a3d",
        borderRadius: 10,
        color: "#f2e8d5",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong>Backpack</strong>
        <button
          onClick={() => patch({ inventoryOpen: false })}
          style={{ cursor: "pointer", background: "none", border: "none", color: "#f2e8d5", font: "inherit" }}
        >
          ✕
        </button>
      </div>
      {rows.length === 0 ? (
        <div style={{ opacity: 0.6 }}>Empty</div>
      ) : (
        rows.map(([id, n]) => (
          <div key={id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span>{LABELS[id] ?? id}</span>
            <span style={{ color: "#a7f3d0", fontVariantNumeric: "tabular-nums" }}>×{n}</span>
          </div>
        ))
      )}
      <div style={{ marginTop: 10, fontSize: 11, opacity: 0.55 }}>I to close</div>
    </div>
  );
}

"use client";

import { useFarmStore } from "../stores/farm";

/** Energy + farming XP readout (bottom-left). Reads server-owned state. */
export function EnergyBar() {
  const farm = useFarmStore((s) => s.farm);
  if (!farm) return null;
  const { energy, energyMax, farmingXp } = farm.character;
  const pct = Math.max(0, Math.min(100, (energy / energyMax) * 100));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          width: 180,
          padding: "6px 8px",
          background: "rgba(43, 34, 24, 0.82)",
          border: "1px solid #5c4a3d",
          borderRadius: 6,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span>Energy</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {energy}/{energyMax}
          </span>
        </div>
        <div style={{ marginTop: 4, height: 8, background: "#3a2e26", borderRadius: 4 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "#6fa05a", borderRadius: 4 }} />
        </div>
        <div style={{ marginTop: 5, fontSize: 12, color: "#a7f3d0" }}>
          🌱 Farming · {farmingXp} XP
        </div>
      </div>
    </div>
  );
}

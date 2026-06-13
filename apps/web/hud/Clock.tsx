"use client";

import { useHudStore } from "../stores/hud";

/** In-game clock (1 game minute per real second). Real skin comes later. */
export function Clock() {
  const minutesOfDay = useHudStore((s) => s.minutesOfDay);
  const hh = String(Math.floor(minutesOfDay / 60)).padStart(2, "0");
  const mm = String(minutesOfDay % 60).padStart(2, "0");

  return (
    <div
      style={{
        padding: "4px 10px",
        background: "rgba(15, 17, 23, 0.75)",
        border: "1px solid #2a2d3a",
        borderRadius: 6,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      🕗 {hh}:{mm}
    </div>
  );
}

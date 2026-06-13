"use client";

import { useHudStore } from "../stores/hud";

/** FPS counter — rendered in development builds only. */
export function Fps() {
  const fps = useHudStore((s) => s.fps);
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div
      style={{
        padding: "4px 10px",
        background: "rgba(15, 17, 23, 0.75)",
        border: "1px solid #2a2d3a",
        borderRadius: 6,
        fontVariantNumeric: "tabular-nums",
        color: fps >= 55 ? "#5ee6a8" : "#e6c95e",
      }}
    >
      {fps} fps
    </div>
  );
}

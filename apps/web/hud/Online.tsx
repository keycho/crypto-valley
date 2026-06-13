"use client";

import { useMpStore } from "../stores/mp";

/** "N players online" presence indicator (visible while connected to town). */
export function Online() {
  const n = useMpStore((s) => s.onlineCount);
  if (n <= 0) return null;
  return (
    <div
      style={{
        padding: "4px 10px",
        background: "rgba(15, 17, 23, 0.75)",
        border: "1px solid #2a2d3a",
        borderRadius: 6,
        fontSize: 13,
        color: "#5ee6a8",
        width: "fit-content",
      }}
    >
      ● {n} online
    </div>
  );
}

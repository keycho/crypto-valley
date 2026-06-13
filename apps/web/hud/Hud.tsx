"use client";

import { Clock } from "./Clock";
import { Fps } from "./Fps";
import { HudBridge } from "./HudBridge";

/** React overlay on top of the Phaser canvas. Pointer events stay on the game. */
export function Hud() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: 12,
        fontSize: 14,
      }}
    >
      <HudBridge />
      <Clock />
      <Fps />
    </div>
  );
}

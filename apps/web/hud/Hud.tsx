"use client";

import { Clock } from "./Clock";
import { Fps } from "./Fps";
import { HudBridge } from "./HudBridge";

/** React overlay on top of the Phaser canvas. Pointer events stay on the game. */
export function Hud() {
  return (
    <>
      {/* Very light warm-dark vignette (depth pass FIX 3). Static screen-edge
          falloff only — not a filter over the world (art bible Law 3). */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 75% 70% at 50% 48%, transparent 62%, rgba(26, 18, 12, 0.18) 100%)",
        }}
      />
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
    </>
  );
}

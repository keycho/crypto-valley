"use client";

import { Chat } from "./Chat";
import { Clock } from "./Clock";
import { EnergyBar } from "./EnergyBar";
import { Fps } from "./Fps";
import { Hotbar } from "./Hotbar";
import { HudBridge } from "./HudBridge";
import { Inventory } from "./Inventory";
import { Online } from "./Online";
import { PlotPanel } from "./PlotPanel";
import { Toast } from "./Toast";
import { useHotbarKeys } from "./useHotbarKeys";

/** React overlay on top of the Phaser canvas. Pointer events stay on the game. */
export function Hud() {
  useHotbarKeys();
  return (
    <>
      {/* Very light warm-dark vignette (depth pass). Static edge falloff only —
          not a filter over the world (art bible Law 3). */}
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
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", fontSize: 14 }}>
        <HudBridge />
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <Clock />
          <Online />
          <EnergyBar />
        </div>
        <div style={{ position: "absolute", top: 12, right: 12 }}>
          <Fps />
        </div>
        <Toast />
        <div style={{ position: "absolute", bottom: 12, left: 12 }}>
          <Chat />
        </div>
        <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)" }}>
          <Hotbar />
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 16,
            right: 12,
            color: "#f2e8d5",
            fontSize: 11,
            opacity: 0.6,
            textAlign: "right",
          }}
        >
          WASD move · Space use/claim/chop · 1–3 tool · I bag · Enter chat
        </div>
        <PlotPanel />
        <Inventory />
      </div>
    </>
  );
}

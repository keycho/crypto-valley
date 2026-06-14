"use client";

import { Chat } from "./Chat";
import { Clock } from "./Clock";
import { EnergyBar } from "./EnergyBar";
import { Fps } from "./Fps";
import { Hotbar } from "./Hotbar";
import { HudBridge } from "./HudBridge";
import { Inventory } from "./Inventory";
import { LandMarket } from "./LandMarket";
import { Leaderboard } from "./Leaderboard";
import { Online } from "./Online";
import { PlotPanel } from "./PlotPanel";
import { QuestLog } from "./QuestLog";
import { QuestTracker } from "./QuestTracker";
import { SeasonEndModal } from "./SeasonEndModal";
import { Toast } from "./Toast";
import { useHotbarKeys } from "./useHotbarKeys";
import { useMarketStore } from "../stores/market";
import { useQuestUi } from "../stores/questUi";
import { useSeasonUi } from "../stores/seasonUi";
import { useWorldStore } from "../stores/world";

const hudBtn: React.CSSProperties = {
  pointerEvents: "auto",
  position: "relative",
  padding: "4px 10px",
  background: "rgba(43,34,24,0.9)",
  border: "1px solid #5c4a3d",
  borderRadius: 8,
  color: "#f2e8d5",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
};

/** Opens the leaderboard; shows a 🏆 count when the player has trophies. */
function SeasonButton() {
  const toggle = useSeasonUi((s) => s.toggle);
  const trophies = useWorldStore((s) => s.world?.season?.trophies.length ?? 0);
  return (
    <button onClick={toggle} style={hudBtn}>
      🏆 Season{trophies > 0 ? ` (${trophies})` : ""}
    </button>
  );
}

/** Opens the Land Market board; dot when any plot is currently listed. */
function MarketButton() {
  const toggle = useMarketStore((s) => s.toggleBoard);
  const anyListed = useWorldStore((s) => (s.world?.plots ?? []).some((p) => p.price !== null));
  return (
    <button onClick={toggle} style={hudBtn}>
      🏞 Market
      {anyListed ? (
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#34d399",
            border: "1px solid #0b140f",
          }}
        />
      ) : null}
    </button>
  );
}

/** Top-right button that opens the Quest Log; dot when a reward is claimable. */
function QuestButton() {
  const toggle = useQuestUi((s) => s.toggle);
  const claimable = useWorldStore((s) => (s.world?.quests ?? []).some((q) => q.status === "complete"));
  return (
    <button
      onClick={toggle}
      style={{
        pointerEvents: "auto",
        position: "relative",
        padding: "4px 10px",
        background: "rgba(43,34,24,0.9)",
        border: "1px solid #5c4a3d",
        borderRadius: 8,
        color: "#f2e8d5",
        font: "inherit",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      📜 Quests
      {claimable ? (
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#34d399",
            border: "1px solid #0b140f",
          }}
        />
      ) : null}
    </button>
  );
}

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
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <SeasonButton />
          <MarketButton />
          <QuestButton />
          <Fps />
        </div>
        <QuestTracker />
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
          WASD move · Space use/claim/chop · 🔨 Build · 🏞 Market · 🏆 Season · Q quests
        </div>
        <PlotPanel />
        <QuestLog />
        <LandMarket />
        <Leaderboard />
        <SeasonEndModal />
        <Inventory />
      </div>
    </>
  );
}

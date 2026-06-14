"use client";

import { CLAIM_COST_SHARDS, MAX_TIER, PLOT_TIERS, upgradeCost } from "@crypto-valley/content";

import { gameBus } from "../game/bus";
import { useFarmStore } from "../stores/farm";
import { useWorldStore } from "../stores/world";

const card: React.CSSProperties = {
  pointerEvents: "auto",
  position: "absolute",
  bottom: 92,
  left: "50%",
  transform: "translateX(-50%)",
  width: 280,
  padding: "10px 12px",
  background: "rgba(43, 34, 24, 0.94)",
  border: "1px solid #5c4a3d",
  borderRadius: 10,
  color: "#f2e8d5",
  fontSize: 13,
};

function CostRow({ label, need, have }: { label: string; need: number; have: number }) {
  if (need === 0) return null;
  const ok = have >= need;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
      <span style={{ opacity: 0.85 }}>{label}</span>
      <span style={{ color: ok ? "#a7f3d0" : "#e9a178", fontVariantNumeric: "tabular-nums" }}>
        {have} / {need}
      </span>
    </div>
  );
}

function btn(enabled: boolean): React.CSSProperties {
  return {
    marginTop: 8,
    width: "100%",
    padding: "7px 0",
    cursor: enabled ? "pointer" : "not-allowed",
    color: enabled ? "#0b140f" : "#9c907f",
    background: enabled ? "#34d399" : "rgba(92,74,61,0.5)",
    border: "none",
    borderRadius: 7,
    font: "inherit",
    fontWeight: 700,
  };
}

/**
 * Contextual plot card (P6): shows when the player stands on a plot (claim /
 * upgrade) or next to a gather node (chop / mine hint). Buttons emit bus events
 * the TownController turns into server-authoritative /world/act calls.
 */
export function PlotPanel() {
  const world = useWorldStore((s) => s.world);
  const standingPlot = useWorldStore((s) => s.standingPlot);
  const nearNode = useWorldStore((s) => s.nearNode);
  const me = useFarmStore((s) => s.characterId);

  if (!world) return null;

  // Standing on a plot takes precedence over a nearby node.
  if (standingPlot === null) {
    if (!nearNode) return null;
    return (
      <div style={{ ...card, width: 220, textAlign: "center" }}>
        Press <b>Space</b> to {nearNode.kind === "tree" ? "chop the tree" : "mine the rock"}
      </div>
    );
  }

  const plot = world.plots.find((p) => p.index === standingPlot);
  if (!plot) return null;
  const mine = plot.ownerId !== null && plot.ownerId === me;
  const tierName = PLOT_TIERS[plot.tier]?.name ?? "Lot";

  // Unclaimed → claim.
  if (plot.ownerId === null) {
    const owns = world.me.ownedPlot !== null;
    const poor = world.me.shards < CLAIM_COST_SHARDS;
    const enabled = !owns && !poor;
    return (
      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>Empty Lot</div>
        <div style={{ opacity: 0.8 }}>
          Claim for <span style={{ color: "#a7f3d0" }}>{CLAIM_COST_SHARDS} Shards</span>
        </div>
        <button style={btn(enabled)} disabled={!enabled} onClick={() => gameBus.emit("plotClaim", { index: plot.index })}>
          {owns ? "You already own a plot" : poor ? "Not enough Shards" : "Claim this plot"}
        </button>
      </div>
    );
  }

  // Owned by someone else → read-only nameplate.
  if (!mine) {
    return (
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontWeight: 700 }}>
          {plot.ownerName ?? "Someone"}&rsquo;s {tierName}
        </div>
        <div style={{ opacity: 0.6, fontSize: 11, marginTop: 2 }}>Tier {plot.tier}</div>
      </div>
    );
  }

  // My plot → upgrade ladder.
  const next = upgradeCost(plot.tier);
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        Your {tierName} <span style={{ opacity: 0.55, fontWeight: 400 }}>· tier {plot.tier}</span>
      </div>
      {next ? (
        <>
          <div style={{ opacity: 0.8, marginBottom: 2 }}>
            Upgrade to {PLOT_TIERS[plot.tier + 1].name}:
          </div>
          <CostRow label="Wood" need={next.wood} have={world.me.wood} />
          <CostRow label="Stone" need={next.stone} have={world.me.stone} />
          <CostRow label="Shards" need={next.shards} have={world.me.shards} />
          {(() => {
            const enabled =
              world.me.wood >= next.wood &&
              world.me.stone >= next.stone &&
              world.me.shards >= next.shards;
            return (
              <button
                style={btn(enabled)}
                disabled={!enabled}
                onClick={() => gameBus.emit("plotUpgrade", { index: plot.index })}
              >
                {enabled ? `Build ${PLOT_TIERS[plot.tier + 1].name}` : "Gather more materials"}
              </button>
            );
          })()}
        </>
      ) : (
        <div style={{ color: "#a7f3d0", textAlign: "center", padding: "4px 0" }}>
          ★ Mansion — fully upgraded
        </div>
      )}
      {plot.tier === MAX_TIER ? null : (
        <div style={{ opacity: 0.5, fontSize: 11, marginTop: 6 }}>
          Chop trees + mine rocks around the island for materials.
        </div>
      )}
    </div>
  );
}

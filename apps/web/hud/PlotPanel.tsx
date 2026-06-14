"use client";

import {
  CLAIM_COST_SHARDS,
  nextStructure,
  PLACEABLE_STRUCTURES,
  STRUCTURE_BY_ID,
  structureRefund,
} from "@crypto-valley/content";

import { gameBus } from "../game/bus";
import { useBuildStore } from "../stores/build";
import { useFarmStore } from "../stores/farm";
import { useWorldStore } from "../stores/world";

const card: React.CSSProperties = {
  pointerEvents: "auto",
  position: "absolute",
  bottom: 92,
  left: "50%",
  transform: "translateX(-50%)",
  width: 300,
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

function btn(enabled: boolean, accent = "#34d399"): React.CSSProperties {
  return {
    marginTop: 8,
    width: "100%",
    padding: "7px 0",
    cursor: enabled ? "pointer" : "not-allowed",
    color: enabled ? "#0b140f" : "#9c907f",
    background: enabled ? accent : "rgba(92,74,61,0.5)",
    border: "none",
    borderRadius: 7,
    font: "inherit",
    fontWeight: 700,
  };
}

/**
 * Contextual build HUD (P7). Modes, in priority order: build palette (place
 * structures) → inspect a selected structure (upgrade/remove) → claim an
 * unclaimed plot → "build on your plot" → other player's nameplate → gather hint.
 * Buttons emit bus events / set the build store; the TownController turns those
 * into server-authoritative /world/act calls.
 */
export function PlotPanel() {
  const world = useWorldStore((s) => s.world);
  const standingPlot = useWorldStore((s) => s.standingPlot);
  const nearNode = useWorldStore((s) => s.nearNode);
  const me = useFarmStore((s) => s.characterId);
  const buildMode = useBuildStore((s) => s.buildMode);
  const selectedDef = useBuildStore((s) => s.selectedDef);
  const selectedStructureId = useBuildStore((s) => s.selectedStructureId);
  const setBuildMode = useBuildStore((s) => s.setBuildMode);
  const selectDef = useBuildStore((s) => s.selectDef);
  const selectStructure = useBuildStore((s) => s.selectStructure);

  if (!world) return null;
  const ownsPlot = world.me.ownedPlot !== null;

  // --- 1. BUILD MODE: structure palette ---------------------------------------
  if (buildMode) {
    const def = selectedDef ? STRUCTURE_BY_ID[selectedDef] : null;
    return (
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <b>Build mode</b>
          <span style={{ opacity: 0.6, fontSize: 11 }}>click your plot to place</span>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {PLACEABLE_STRUCTURES.map((d) => {
            const sel = d.id === selectedDef;
            return (
              <button
                key={d.id}
                onClick={() => selectDef(d.id)}
                style={{
                  flex: "1 0 30%",
                  padding: "5px 2px",
                  cursor: "pointer",
                  background: sel ? "#34d399" : "rgba(92,74,61,0.45)",
                  color: sel ? "#0b140f" : "#f2e8d5",
                  border: sel ? "1px solid #a7f3d0" : "1px solid #5c4a3d",
                  borderRadius: 6,
                  font: "inherit",
                  fontSize: 12,
                  fontWeight: sel ? 700 : 400,
                }}
              >
                {d.name}
              </button>
            );
          })}
        </div>
        {def ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ opacity: 0.8, marginBottom: 2 }}>
              {def.name} · {def.footprint.w}×{def.footprint.h}
            </div>
            <CostRow label="Wood" need={def.cost.wood} have={world.me.wood} />
            <CostRow label="Stone" need={def.cost.stone} have={world.me.stone} />
            <CostRow label="Shards" need={def.cost.shards} have={world.me.shards} />
          </div>
        ) : null}
        <button style={btn(true, "#c8a06b")} onClick={() => setBuildMode(false)}>
          Done
        </button>
      </div>
    );
  }

  // --- 2. INSPECT a selected (owned) structure --------------------------------
  if (selectedStructureId) {
    const s = world.structures.find((x) => x.id === selectedStructureId);
    const def = s ? STRUCTURE_BY_ID[s.defId] : null;
    if (s && def) {
      const next = nextStructure(def.id);
      const refund = structureRefund(def);
      const affordable =
        !!next &&
        world.me.wood >= next.cost.wood &&
        world.me.stone >= next.cost.stone &&
        world.me.shards >= next.cost.shards;
      return (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <b>{def.name}</b>
            <button
              onClick={() => selectStructure(null)}
              style={{ background: "none", border: "none", color: "#9c907f", cursor: "pointer", font: "inherit" }}
            >
              ✕
            </button>
          </div>
          {next ? (
            <>
              <div style={{ opacity: 0.8, marginBottom: 2 }}>Upgrade to {next.name}:</div>
              <CostRow label="Wood" need={next.cost.wood} have={world.me.wood} />
              <CostRow label="Stone" need={next.cost.stone} have={world.me.stone} />
              <CostRow label="Shards" need={next.cost.shards} have={world.me.shards} />
              <button
                style={btn(affordable)}
                disabled={!affordable}
                onClick={() => gameBus.emit("structureUpgrade", { id: s.id })}
              >
                {affordable ? `Upgrade to ${next.name}` : "Gather more materials"}
              </button>
            </>
          ) : (
            <div style={{ color: "#a7f3d0", textAlign: "center", padding: "2px 0" }}>★ Top tier</div>
          )}
          <button
            style={btn(true, "#b07a5a")}
            onClick={() => {
              gameBus.emit("structureRemove", { id: s.id });
              selectStructure(null);
            }}
          >
            Remove (+{refund.wood}w {refund.stone}s {refund.shards}sh)
          </button>
        </div>
      );
    }
  }

  // --- 3/4. standing on a plot ------------------------------------------------
  if (standingPlot !== null) {
    const plot = world.plots.find((p) => p.index === standingPlot);
    if (plot) {
      const mine = plot.ownerId !== null && plot.ownerId === me;
      if (plot.ownerId === null) {
        const owns = ownsPlot;
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
      if (mine) {
        const count = world.structures.filter((x) => x.plotIndex === plot.index).length;
        return (
          <div style={card}>
            <div style={{ fontWeight: 700 }}>Your plot</div>
            <div style={{ opacity: 0.7, fontSize: 12, margin: "2px 0 2px" }}>
              {count} structure{count === 1 ? "" : "s"} · wood {world.me.wood} · stone {world.me.stone}
            </div>
            <button style={btn(true)} onClick={() => setBuildMode(true)}>
              🔨 Build
            </button>
            <div style={{ opacity: 0.5, fontSize: 11, marginTop: 6 }}>
              Click a structure to upgrade it. Chop trees / mine rocks for materials.
            </div>
          </div>
        );
      }
      return (
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontWeight: 700 }}>{plot.ownerName ?? "Someone"}&rsquo;s plot</div>
        </div>
      );
    }
  }

  // --- 5. near a gather node --------------------------------------------------
  if (nearNode) {
    return (
      <div style={{ ...card, width: 220, textAlign: "center" }}>
        Press <b>Space</b> to {nearNode.kind === "tree" ? "chop the tree" : "mine the rock"}
      </div>
    );
  }

  // --- 6. own a plot but standing elsewhere → a quick Build entry -------------
  if (ownsPlot) {
    return (
      <div style={{ ...card, width: 170, textAlign: "center", padding: "8px 12px" }}>
        <button style={{ ...btn(true), marginTop: 0 }} onClick={() => setBuildMode(true)}>
          🔨 Build
        </button>
      </div>
    );
  }

  return null;
}

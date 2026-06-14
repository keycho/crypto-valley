"use client";

import { useState } from "react";

import {
  CLAIM_COST_SHARDS,
  marketFee,
  nextStructure,
  PLACEABLE_STRUCTURES,
  STRUCTURE_BY_ID,
  structureRefund,
} from "@crypto-valley/content";

import { gameBus } from "../game/bus";
import { useBuildStore } from "../stores/build";
import { useFarmStore } from "../stores/farm";
import { useMarketStore } from "../stores/market";
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

const priceInput: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  padding: "6px 8px",
  background: "rgba(11,20,15,0.6)",
  border: "1px solid #5c4a3d",
  borderRadius: 6,
  color: "#f2e8d5",
  font: "inherit",
};

/**
 * Contextual plot HUD (P7/P9). Priority: build palette → buy confirm (in-world
 * for-sale click) → inspect a structure → standing-on-a-plot (claim / your plot
 * with List·Unlist·Build / others') → gather hint → quick Build entry. Buttons
 * emit bus events the TownController turns into server-authoritative actions.
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
  const focusBuy = useMarketStore((s) => s.focusBuy);
  const setFocusBuy = useMarketStore((s) => s.setFocusBuy);
  const listForm = useMarketStore((s) => s.listForm);
  const setListForm = useMarketStore((s) => s.setListForm);
  const [price, setPrice] = useState("100");

  if (!world) return null;
  const owned = world.me.ownedPlots;
  const atCap = owned.length >= world.me.maxPlots;
  const structCount = (idx: number): number => world.structures.filter((s) => s.plotIndex === idx).length;

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

  // --- 2. BUY CONFIRM (clicked an in-world for-sale plot) ----------------------
  if (focusBuy !== null) {
    const plot = world.plots.find((p) => p.index === focusBuy);
    if (plot && plot.price !== null && plot.ownerId !== me) {
      const poor = world.me.shards < plot.price;
      const enabled = !poor && !atCap;
      return (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>
            Buy {plot.ownerName ?? "this"} plot — {structCount(plot.index)} bldg
          </div>
          <div style={{ opacity: 0.85 }}>
            Price <span style={{ color: "#a7f3d0" }}>◈{plot.price}</span> · you have ◈{world.me.shards}
          </div>
          <button style={btn(enabled)} disabled={!enabled} onClick={() => { gameBus.emit("plotBuy", { index: plot.index }); setFocusBuy(null); }}>
            {atCap ? "Plot limit reached (8)" : poor ? "Not enough Shards" : `Buy for ◈${plot.price}`}
          </button>
          <button style={btn(true, "#c8a06b")} onClick={() => setFocusBuy(null)}>
            Cancel
          </button>
        </div>
      );
    }
  }

  // --- 3. INSPECT a selected (owned) structure --------------------------------
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

  // --- 4. standing on a plot --------------------------------------------------
  if (standingPlot !== null) {
    const plot = world.plots.find((p) => p.index === standingPlot);
    if (plot) {
      const mine = plot.ownerId !== null && plot.ownerId === me;
      if (plot.ownerId === null) {
        const poor = world.me.shards < CLAIM_COST_SHARDS;
        const enabled = !atCap && !poor;
        return (
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Empty Lot</div>
            <div style={{ opacity: 0.8 }}>
              Claim for <span style={{ color: "#a7f3d0" }}>{CLAIM_COST_SHARDS} Shards</span>
              <span style={{ opacity: 0.6 }}> · plots {owned.length}/{world.me.maxPlots}</span>
            </div>
            <button style={btn(enabled)} disabled={!enabled} onClick={() => gameBus.emit("plotClaim", { index: plot.index })}>
              {atCap ? "Plot limit reached (8)" : poor ? "Not enough Shards" : "Claim this plot"}
            </button>
          </div>
        );
      }
      if (mine) {
        const listed = plot.price !== null;
        return (
          <div style={card}>
            <div style={{ fontWeight: 700 }}>Your plot · {structCount(plot.index)} bldg</div>
            <div style={{ opacity: 0.7, fontSize: 12, margin: "2px 0" }}>
              plots {owned.length}/{world.me.maxPlots} · ◈{world.me.shards}
            </div>
            <button style={btn(true)} onClick={() => setBuildMode(true)}>
              🔨 Build
            </button>
            {listed ? (
              <button style={btn(true, "#c8a06b")} onClick={() => gameBus.emit("plotUnlist", { index: plot.index })}>
                Listed for ◈{plot.price} · Unlist
              </button>
            ) : listForm === plot.index ? (
              <>
                <input
                  style={priceInput}
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="price in Shards"
                />
                <button
                  style={btn(Number(price) > 0)}
                  disabled={!(Number(price) > 0)}
                  onClick={() => {
                    gameBus.emit("plotList", { index: plot.index, price: Math.floor(Number(price)) });
                    setListForm(null);
                  }}
                >
                  List (fee ◈{marketFee(Math.floor(Number(price) || 0))})
                </button>
              </>
            ) : (
              <button style={btn(true, "#c8a06b")} onClick={() => setListForm(plot.index)}>
                List for sale
              </button>
            )}
          </div>
        );
      }
      return (
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontWeight: 700 }}>{plot.ownerName ?? "Someone"}&rsquo;s plot</div>
          {plot.price !== null ? (
            <button style={btn(!atCap && world.me.shards >= plot.price)} disabled={atCap || world.me.shards < plot.price} onClick={() => gameBus.emit("plotBuy", { index: plot.index })}>
              Buy for ◈{plot.price}
            </button>
          ) : null}
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
  if (owned.length > 0) {
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

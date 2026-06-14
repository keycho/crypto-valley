"use client";

import { useState } from "react";

import type { PlotView } from "@crypto-valley/shared";

import { gameBus } from "../game/bus";
import { useFarmStore } from "../stores/farm";
import { useMarketStore } from "../stores/market";
import { useWorldStore } from "../stores/world";

// ---- styles (kept separate from logic for the coming reskin) ----------------
const S = {
  panel: {
    pointerEvents: "auto",
    position: "absolute",
    top: 52,
    left: "50%",
    transform: "translateX(-50%)",
    width: 360,
    maxHeight: "calc(100% - 130px)",
    overflowY: "auto",
    padding: "12px 14px",
    background: "rgba(43, 34, 24, 0.96)",
    border: "1px solid #5c4a3d",
    borderRadius: 10,
    color: "#f2e8d5",
    fontSize: 13,
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  sub: { opacity: 0.7, fontSize: 12, margin: "2px 0 8px" },
  sectionLabel: { opacity: 0.55, fontSize: 11, letterSpacing: 1, margin: "8px 0 4px", textTransform: "uppercase" },
  row: { display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: "1px solid rgba(255,255,255,0.08)" },
  grow: { flex: 1 },
  price: { color: "#a7f3d0", fontVariantNumeric: "tabular-nums" },
  smallBtn: (enabled: boolean, accent = "#34d399"): React.CSSProperties => ({
    padding: "5px 10px",
    cursor: enabled ? "pointer" : "not-allowed",
    color: enabled ? "#0b140f" : "#9c907f",
    background: enabled ? accent : "rgba(92,74,61,0.5)",
    border: "none",
    borderRadius: 6,
    font: "inherit",
    fontWeight: 700,
    fontSize: 12,
  }),
  input: {
    width: 64,
    padding: "4px 6px",
    background: "rgba(11,20,15,0.6)",
    border: "1px solid #5c4a3d",
    borderRadius: 6,
    color: "#f2e8d5",
    font: "inherit",
    fontSize: 12,
  },
  close: { background: "none", border: "none", color: "#9c907f", cursor: "pointer", font: "inherit", fontSize: 16 },
} satisfies Record<string, unknown>;

function bldg(structures: { plotIndex: number }[], idx: number): number {
  return structures.filter((s) => s.plotIndex === idx).length;
}

function MyPlotRow({ plot, count }: { plot: PlotView; count: number }) {
  const [price, setPrice] = useState("100");
  const listed = plot.price !== null;
  return (
    <div style={S.row as React.CSSProperties}>
      <span style={S.grow as React.CSSProperties}>
        Plot {plot.index} · {count} bldg
      </span>
      {listed ? (
        <>
          <span style={S.price}>◈{plot.price}</span>
          <button style={S.smallBtn(true, "#c8a06b")} onClick={() => gameBus.emit("plotUnlist", { index: plot.index })}>
            Unlist
          </button>
        </>
      ) : (
        <>
          <input style={S.input as React.CSSProperties} type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          <button
            style={S.smallBtn(Number(price) > 0)}
            disabled={!(Number(price) > 0)}
            onClick={() => gameBus.emit("plotList", { index: plot.index, price: Math.floor(Number(price)) })}
          >
            List
          </button>
        </>
      )}
    </div>
  );
}

/** The land exchange — the degen order book: all active listings + your plots. */
export function LandMarket() {
  const open = useMarketStore((s) => s.boardOpen);
  const setOpen = useMarketStore((s) => s.setBoardOpen);
  const world = useWorldStore((s) => s.world);
  const me = useFarmStore((s) => s.characterId);
  if (!open || !world) return null;

  const atCap = world.me.ownedPlots.length >= world.me.maxPlots;
  const forSale = world.plots
    .filter((p) => p.price !== null && p.ownerId !== me)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const mine = world.plots.filter((p) => p.ownerId === me).sort((a, b) => a.index - b.index);

  return (
    <div style={S.panel as React.CSSProperties}>
      <div style={S.header as React.CSSProperties}>
        <b>🏞 Land Market</b>
        <button style={S.close} onClick={() => setOpen(false)} aria-label="Close">
          ✕
        </button>
      </div>
      <div style={S.sub}>
        Your Shards ◈{world.me.shards} · plots {world.me.ownedPlots.length}/{world.me.maxPlots}
      </div>

      <div style={S.sectionLabel as React.CSSProperties}>For sale ({forSale.length})</div>
      {forSale.length === 0 ? <div style={{ opacity: 0.5, fontSize: 12 }}>No plots listed right now.</div> : null}
      {forSale.map((p) => {
        const affordable = world.me.shards >= (p.price ?? 0) && !atCap;
        return (
          <div key={p.index} style={S.row as React.CSSProperties}>
            <span style={S.grow as React.CSSProperties}>
              {p.ownerName ?? "Plot"} · {bldg(world.structures, p.index)} bldg
            </span>
            <span style={S.price}>◈{p.price}</span>
            <button
              style={S.smallBtn(affordable)}
              disabled={!affordable}
              onClick={() => gameBus.emit("plotBuy", { index: p.index })}
            >
              {atCap ? "Full" : "Buy"}
            </button>
          </div>
        );
      })}

      <div style={S.sectionLabel as React.CSSProperties}>Your plots ({mine.length})</div>
      {mine.length === 0 ? <div style={{ opacity: 0.5, fontSize: 12 }}>Claim a plot to start your portfolio.</div> : null}
      {mine.map((p) => (
        <MyPlotRow key={p.index} plot={p} count={bldg(world.structures, p.index)} />
      ))}
    </div>
  );
}

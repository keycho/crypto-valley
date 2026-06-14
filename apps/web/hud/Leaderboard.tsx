"use client";

import { useEffect, useState } from "react";

import { trophyTitle, type Board } from "@crypto-valley/content";

import { useFarmStore } from "../stores/farm";
import { useSeasonUi } from "../stores/seasonUi";
import { useWorldStore } from "../stores/world";

// ---- styles (separate from logic for the coming reskin) --------------------
const S = {
  panel: {
    pointerEvents: "auto",
    position: "absolute",
    top: 52,
    left: "50%",
    transform: "translateX(-50%)",
    width: 340,
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
  sub: { opacity: 0.8, fontSize: 12, margin: "2px 0 8px" },
  tabs: { display: "flex", gap: 6, marginBottom: 6 },
  tab: (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "5px 0",
    cursor: "pointer",
    background: active ? "#34d399" : "rgba(92,74,61,0.45)",
    color: active ? "#0b140f" : "#f2e8d5",
    border: active ? "1px solid #a7f3d0" : "1px solid #5c4a3d",
    borderRadius: 6,
    font: "inherit",
    fontSize: 12,
    fontWeight: active ? 700 : 400,
  }),
  row: (mine: boolean): React.CSSProperties => ({
    display: "flex",
    gap: 8,
    padding: "4px 6px",
    borderRadius: 5,
    background: mine ? "rgba(52,211,153,0.18)" : "transparent",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  }),
  rank: { width: 24, opacity: 0.7, fontVariantNumeric: "tabular-nums" },
  name: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  score: { color: "#a7f3d0", fontVariantNumeric: "tabular-nums" },
  section: { opacity: 0.55, fontSize: 11, letterSpacing: 1, margin: "10px 0 4px", textTransform: "uppercase" },
  trophy: { display: "flex", gap: 6, padding: "2px 0" },
  close: { background: "none", border: "none", color: "#9c907f", cursor: "pointer", font: "inherit", fontSize: 16 },
} satisfies Record<string, unknown>;

function countdown(ms: number): string {
  if (ms <= 0) return "ending…";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/** The season + dual-leaderboard panel (toggle from the HUD 🏆 button or `L`). */
export function Leaderboard() {
  const open = useSeasonUi((s) => s.open);
  const setOpen = useSeasonUi((s) => s.set);
  const season = useWorldStore((s) => s.world?.season);
  const me = useFarmStore((s) => s.characterId);
  const [tab, setTab] = useState<Board>("profit");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  if (!open || !season) return null;
  const board = tab === "profit" ? season.profitBoard : season.portfolioBoard;

  return (
    <div style={S.panel as React.CSSProperties}>
      <div style={S.header as React.CSSProperties}>
        <b>🏆 Season {season.number}</b>
        <button style={S.close} onClick={() => setOpen(false)} aria-label="Close">
          ✕
        </button>
      </div>
      <div style={S.sub}>
        Ends in <b>{countdown(season.endsAt - now)}</b> · prize pool <span style={{ color: "#a7f3d0" }}>◈{season.pool}</span>
      </div>

      <div style={S.tabs}>
        <button style={S.tab(tab === "profit")} onClick={() => setTab("profit")}>
          Profit (flips)
        </button>
        <button style={S.tab(tab === "portfolio")} onClick={() => setTab("portfolio")}>
          Portfolio
        </button>
      </div>

      {board.length === 0 ? (
        <div style={{ opacity: 0.5, fontSize: 12 }}>No ranked players yet — be the first.</div>
      ) : (
        board.map((e) => (
          <div key={e.characterId} style={S.row(e.characterId === me)}>
            <span style={S.rank}>#{e.rank}</span>
            <span style={S.name}>{e.name}</span>
            <span style={S.score}>◈{e.score}</span>
          </div>
        ))
      )}

      <div style={S.section as React.CSSProperties}>Your standing</div>
      <div style={{ fontSize: 12 }}>
        Profit <span style={{ color: "#a7f3d0" }}>◈{season.me.profit}</span>
        {season.me.profitRank ? ` (#${season.me.profitRank})` : " (unranked)"} · Portfolio{" "}
        <span style={{ color: "#a7f3d0" }}>◈{season.me.portfolioValue}</span>
        {season.me.portfolioRank ? ` (#${season.me.portfolioRank})` : " (unranked)"}
      </div>

      <div style={S.section as React.CSSProperties}>Your trophies ({season.trophies.length})</div>
      {season.trophies.length === 0 ? (
        <div style={{ opacity: 0.5, fontSize: 12 }}>No trophies yet — win a season.</div>
      ) : (
        season.trophies.map((tr, i) => (
          <div key={i} style={S.trophy}>
            <span>🏆</span>
            <span>{trophyTitle(tr.seasonNumber, tr.board as Board, tr.rank)}</span>
            {tr.prize > 0 ? <span style={{ marginLeft: "auto", color: "#a7f3d0" }}>◈{tr.prize}</span> : null}
          </div>
        ))
      )}
    </div>
  );
}

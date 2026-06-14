"use client";

import { useEffect, useRef, useState } from "react";

import { trophyTitle, type Board } from "@crypto-valley/content";
import type { SeasonTrophy } from "@crypto-valley/shared";

import { useWorldStore } from "../stores/world";

/**
 * Pops a result when a season rolls over (the world's season number increments):
 * the player's final placements + any prize/trophy for the season that just ended.
 */
export function SeasonEndModal() {
  const season = useWorldStore((s) => s.world?.season);
  const prev = useRef<number | null>(null);
  const [shown, setShown] = useState<{ number: number; results: SeasonTrophy[] } | null>(null);

  useEffect(() => {
    if (!season) return;
    if (prev.current !== null && season.number > prev.current) {
      const ended = season.number - 1;
      setShown({ number: ended, results: season.trophies.filter((t) => t.seasonNumber === ended) });
    }
    prev.current = season.number;
  }, [season]);

  if (!shown) return null;
  const won = shown.results.reduce((s, r) => s + r.prize, 0);

  return (
    <div
      style={{
        pointerEvents: "auto",
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(11,20,15,0.45)",
      }}
      onClick={() => setShown(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 300,
          padding: "16px 18px",
          background: "rgba(43,34,24,0.98)",
          border: "1px solid #5c4a3d",
          borderRadius: 12,
          color: "#f2e8d5",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Season {shown.number} ended</div>
        {shown.results.length === 0 ? (
          <div style={{ opacity: 0.8, fontSize: 13, margin: "6px 0" }}>
            No prize this time — flip land and climb next season!
          </div>
        ) : (
          <>
            <div style={{ color: "#a7f3d0", fontWeight: 700, margin: "6px 0" }}>
              You won ◈{won}!
            </div>
            {shown.results.map((r, i) => (
              <div key={i} style={{ fontSize: 13, margin: "2px 0" }}>
                🏆 {trophyTitle(r.seasonNumber, r.board as Board, r.rank)}
                {r.prize > 0 ? ` · ◈${r.prize}` : ""}
              </div>
            ))}
          </>
        )}
        <button
          onClick={() => setShown(null)}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "7px 0",
            cursor: "pointer",
            color: "#0b140f",
            background: "#34d399",
            border: "none",
            borderRadius: 7,
            font: "inherit",
            fontWeight: 700,
          }}
        >
          A new season begins
        </button>
      </div>
    </div>
  );
}

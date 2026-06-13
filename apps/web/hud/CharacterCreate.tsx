"use client";

import { useState } from "react";

import { CHARACTER_SHEETS, type CharacterSheet } from "@crypto-valley/shared";

import { createCharacter } from "../game/api";
import { useFarmStore } from "../stores/farm";
import { useMpStore } from "../stores/mp";

/** Down-facing idle frame (index 3) of a sheet, scaled 3x for the picker. */
function Avatar({ sheet }: { sheet: CharacterSheet }) {
  return (
    <div
      style={{
        width: 48,
        height: 96,
        backgroundImage: `url(/assets/characters/${sheet}_idle.png)`,
        backgroundSize: "192px 96px",
        backgroundPosition: "-144px 0",
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
      }}
    />
  );
}

/** Pre-game screen: name + appearance, then Enter World. */
export function CharacterCreate() {
  const [name, setName] = useState("Player");
  const [sheet, setSheet] = useState<CharacterSheet>("adam");
  const [busy, setBusy] = useState(false);

  const enter = async (): Promise<void> => {
    const display = name.trim() || "Player";
    setBusy(true);
    try {
      const id = await createCharacter(display, { sheet });
      useFarmStore.getState().patch({ characterId: id });
      useMpStore.getState().enter(display, { sheet });
    } catch {
      setBusy(false);
    }
  };

  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        background: "#0f1117",
        color: "#f2e8d5",
        fontFamily: "ui-monospace, monospace",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0, color: "#5ee6a8" }}>Crypto Valley</h1>
        <p style={{ opacity: 0.7, marginTop: 6 }}>Enter the shared town.</p>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 13, opacity: 0.8 }}>Display name</span>
        <input
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: 220,
            padding: "8px 10px",
            background: "#1a1d24",
            border: "1px solid #5c4a3d",
            borderRadius: 6,
            color: "#f2e8d5",
            font: "inherit",
            textAlign: "center",
          }}
        />
      </label>

      <div style={{ display: "flex", gap: 14 }}>
        {CHARACTER_SHEETS.map((s) => {
          const on = s === sheet;
          return (
            <button
              key={s}
              onClick={() => setSheet(s)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "10px 14px",
                cursor: "pointer",
                background: on ? "rgba(94, 230, 168, 0.12)" : "rgba(43, 34, 24, 0.6)",
                border: `2px solid ${on ? "#5ee6a8" : "#5c4a3d"}`,
                borderRadius: 10,
                color: "#f2e8d5",
                font: "inherit",
                textTransform: "capitalize",
              }}
            >
              <Avatar sheet={s} />
              <span style={{ fontSize: 12 }}>{s}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => void enter()}
        disabled={busy}
        style={{
          marginTop: 6,
          padding: "12px 28px",
          cursor: busy ? "wait" : "pointer",
          background: "#34d399",
          color: "#0f1117",
          border: "none",
          borderRadius: 8,
          font: "inherit",
          fontWeight: 700,
        }}
      >
        {busy ? "Entering…" : "Enter World"}
      </button>
    </main>
  );
}

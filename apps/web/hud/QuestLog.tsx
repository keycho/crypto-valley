"use client";

import type { QuestView } from "@crypto-valley/shared";

import { gameBus } from "../game/bus";
import { useQuestUi } from "../stores/questUi";
import { useWorldStore } from "../stores/world";

// ---- styles (kept separate from logic so a reskin only touches this block) ---
const S = {
  panel: {
    pointerEvents: "auto",
    position: "absolute",
    top: 52,
    right: 12,
    width: 320,
    maxHeight: "calc(100% - 120px)",
    overflowY: "auto",
    padding: "12px 14px",
    background: "rgba(43, 34, 24, 0.96)",
    border: "1px solid #5c4a3d",
    borderRadius: 10,
    color: "#f2e8d5",
    fontSize: 13,
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sectionLabel: { opacity: 0.55, fontSize: 11, letterSpacing: 1, margin: "10px 0 4px", textTransform: "uppercase" },
  quest: { padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.08)" },
  title: { fontWeight: 700 },
  desc: { opacity: 0.7, fontSize: 12, margin: "2px 0 6px" },
  objRow: { fontSize: 12, marginBottom: 4 },
  barTrack: { height: 7, background: "rgba(0,0,0,0.35)", borderRadius: 4, overflow: "hidden", marginTop: 2 },
  barFill: (pct: number, done: boolean) => ({
    height: "100%",
    width: `${pct}%`,
    background: done ? "#34d399" : "#c8a06b",
    transition: "width 120ms",
  }),
  reward: { opacity: 0.75, fontSize: 11, marginTop: 4 },
  claim: {
    marginTop: 6,
    width: "100%",
    padding: "6px 0",
    cursor: "pointer",
    color: "#0b140f",
    background: "#34d399",
    border: "none",
    borderRadius: 7,
    font: "inherit",
    fontWeight: 700,
  },
  claimed: { color: "#a7f3d0", fontSize: 12, marginTop: 4 },
  close: { background: "none", border: "none", color: "#9c907f", cursor: "pointer", font: "inherit", fontSize: 16 },
} satisfies Record<string, React.CSSProperties | ((...a: never[]) => React.CSSProperties)>;

function rewardText(q: QuestView): string {
  const parts = [`${q.reward.shards} Shards`, ...q.reward.items.map((r) => `${r.qty} ${r.item}`)];
  if (q.reward.flag) parts.push(`title: ${q.reward.flag.replace(/_/g, " ")}`);
  return parts.join(" · ");
}

function QuestCard({ q }: { q: QuestView }) {
  return (
    <div style={S.quest}>
      <div style={S.title}>
        {q.title}
        {q.status === "complete" ? " ✓" : ""}
      </div>
      <div style={S.desc}>{q.description}</div>
      {q.objectives.map((o, i) => {
        const pct = Math.min(100, (o.progress / o.target) * 100);
        const done = o.progress >= o.target;
        return (
          <div key={i} style={S.objRow}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ opacity: 0.85 }}>{o.label}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: done ? "#a7f3d0" : "#f2e8d5" }}>
                {o.progress}/{o.target}
              </span>
            </div>
            <div style={S.barTrack}>
              <div style={S.barFill(pct, done)} />
            </div>
          </div>
        );
      })}
      <div style={S.reward}>Reward: {rewardText(q)}</div>
      {q.status === "complete" ? (
        <button style={S.claim} onClick={() => gameBus.emit("questClaim", { id: q.id })}>
          Claim reward
        </button>
      ) : q.status === "claimed" ? (
        <div style={S.claimed}>✓ Claimed{q.repeatable ? " · resets next day" : ""}</div>
      ) : null}
    </div>
  );
}

/** The Quest Log panel (toggle with the HUD button or `Q`). */
export function QuestLog() {
  const open = useQuestUi((s) => s.open);
  const setOpen = useQuestUi((s) => s.set);
  const world = useWorldStore((s) => s.world);
  if (!open || !world) return null;

  const story = world.quests.filter((q) => !q.repeatable);
  const dailies = world.quests.filter((q) => q.repeatable);

  return (
    <div style={S.panel as React.CSSProperties}>
      <div style={S.header}>
        <b>📜 Quests</b>
        <button style={S.close} onClick={() => setOpen(false)} aria-label="Close">
          ✕
        </button>
      </div>
      {story.length > 0 ? <div style={S.sectionLabel as React.CSSProperties}>Onboarding</div> : null}
      {story.map((q) => (
        <QuestCard key={q.id} q={q} />
      ))}
      {dailies.length > 0 ? <div style={S.sectionLabel as React.CSSProperties}>Daily</div> : null}
      {dailies.map((q) => (
        <QuestCard key={q.id} q={q} />
      ))}
    </div>
  );
}

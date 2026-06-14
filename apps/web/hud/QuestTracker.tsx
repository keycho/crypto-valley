"use client";

import { useQuestUi } from "../stores/questUi";
import { useWorldStore } from "../stores/world";

// ---- styles (separate from logic) ------------------------------------------
const S = {
  card: {
    pointerEvents: "auto",
    position: "absolute",
    top: 120,
    left: 12,
    width: 210,
    padding: "8px 10px",
    background: "rgba(43, 34, 24, 0.9)",
    border: "1px solid #5c4a3d",
    borderLeft: "3px solid #34d399",
    borderRadius: 8,
    color: "#f2e8d5",
    fontSize: 12,
    cursor: "pointer",
  },
  label: { opacity: 0.5, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" },
  title: { fontWeight: 700, margin: "1px 0 3px" },
  obj: { display: "flex", justifyContent: "space-between", opacity: 0.9 },
  barTrack: { height: 6, background: "rgba(0,0,0,0.35)", borderRadius: 3, overflow: "hidden", marginTop: 3 },
  ready: { color: "#a7f3d0", fontWeight: 700 },
} satisfies Record<string, React.CSSProperties>;

/**
 * The subtle on-screen tracker for the current STORY quest — a new player always
 * sees the next step. Click to open the full Quest Log.
 */
export function QuestTracker() {
  const world = useWorldStore((s) => s.world);
  const toggle = useQuestUi((s) => s.toggle);
  if (!world) return null;

  // The story quest currently in play: lowest-order one not yet claimed.
  const tracked = world.quests
    .filter((q) => !q.repeatable && q.status !== "claimed")
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))[0];
  if (!tracked) return null;

  const obj = tracked.objectives.find((o) => o.progress < o.target) ?? tracked.objectives[0];
  const done = tracked.status === "complete";
  const pct = Math.min(100, (obj.progress / obj.target) * 100);

  return (
    <div style={S.card} onClick={toggle} title="Open quest log (Q)">
      <div style={S.label as React.CSSProperties}>Quest</div>
      <div style={S.title}>{tracked.title}</div>
      {done ? (
        <div style={S.ready}>✓ Ready to claim!</div>
      ) : (
        <>
          <div style={S.obj}>
            <span>{obj.label}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {obj.progress}/{obj.target}
            </span>
          </div>
          <div style={S.barTrack}>
            <div style={{ height: "100%", width: `${pct}%`, background: "#c8a06b" }} />
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";

// Phaser will live inside this component next session. Mounting it client-only
// (ssr: false) proves the dynamic boundary works before any engine code exists.
const GameMount = dynamic(() => import("../../components/GameMount"), {
  ssr: false,
  loading: () => <p style={{ padding: "1.5rem" }}>Loading the valley…</p>,
});

export default function PlayPage() {
  return <GameMount />;
}

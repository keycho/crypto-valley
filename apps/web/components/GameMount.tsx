"use client";

import { useEffect, useRef } from "react";
import type Phaser from "phaser";

import { Hud } from "../hud/Hud";

/**
 * Mounts the Phaser game. This component is loaded via
 * next/dynamic({ ssr: false }) so it only ever runs in the browser, and Phaser
 * itself is imported lazily inside the effect to keep it out of the SSR bundle.
 */
export default function GameMount() {
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: Phaser.Game | undefined;
    let cancelled = false;

    void import("../game/main").then(({ createGame }) => {
      if (!cancelled && parentRef.current) {
        game = createGame(parentRef.current);
      }
    });

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, []);

  return (
    <main style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <div ref={parentRef} style={{ position: "absolute", inset: 0 }} />
      <Hud />
    </main>
  );
}

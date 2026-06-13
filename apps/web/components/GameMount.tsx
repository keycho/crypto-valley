"use client";

import { useEffect, useRef } from "react";
import type Phaser from "phaser";

import { bootstrap, fetchState } from "../game/api";
import { Hud } from "../hud/Hud";
import { useFarmStore } from "../stores/farm";

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

  // Bootstrap the single-player character + initial state (no auth yet, pre-P4).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __cvFarmStore?: typeof useFarmStore }).__cvFarmStore = useFarmStore;
    }
    let alive = true;
    void (async () => {
      try {
        const id = await bootstrap();
        const st = await fetchState(id);
        if (alive) useFarmStore.getState().patch({ characterId: id, farm: st });
      } catch {
        // API offline: the town is still walkable; farming just won't respond.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <div ref={parentRef} style={{ position: "absolute", inset: 0 }} />
      <Hud />
    </main>
  );
}

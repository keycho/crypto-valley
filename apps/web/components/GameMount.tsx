"use client";

import { useEffect, useRef } from "react";
import type Phaser from "phaser";

import { createCharacter } from "../game/api";
import { CharacterCreate } from "../hud/CharacterCreate";
import { Hud } from "../hud/Hud";
import { useBuildStore } from "../stores/build";
import { useFarmStore } from "../stores/farm";
import { useMpStore } from "../stores/mp";
import { useWorldStore } from "../stores/world";

/**
 * Mounts the Phaser game once the player has created a character and entered the
 * world. Loaded via next/dynamic({ ssr: false }), so it only runs in the browser
 * and Phaser is imported lazily inside the effect.
 */
export default function GameMount() {
  const entered = useMpStore((s) => s.entered);
  const parentRef = useRef<HTMLDivElement>(null);

  // Dev handles for headless tests + a one-call entry helper.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as Record<string, unknown>;
    w.__cvFarmStore = useFarmStore;
    w.__cvMpStore = useMpStore;
    w.__cvWorldStore = useWorldStore;
    w.__cvBuildStore = useBuildStore;
    w.__cvEnter = async (name: string, sheet: string): Promise<void> => {
      const id = await createCharacter(name, { sheet });
      useFarmStore.getState().patch({ characterId: id });
      useMpStore.getState().enter(name, { sheet: sheet as never });
    };
  }, []);

  useEffect(() => {
    if (!entered) return;
    let game: Phaser.Game | undefined;
    let cancelled = false;
    void import("../game/main").then(({ createGame }) => {
      if (!cancelled && parentRef.current) game = createGame(parentRef.current);
    });
    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, [entered]);

  if (!entered) return <CharacterCreate />;

  return (
    <main style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <div ref={parentRef} style={{ position: "absolute", inset: 0 }} />
      <Hud />
    </main>
  );
}

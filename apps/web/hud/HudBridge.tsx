"use client";

import { useEffect } from "react";

import { gameBus } from "../game/bus";
import { useHudStore } from "../stores/hud";

/** Subscribes the Zustand HUD store to the Phaser event bus. Renders nothing. */
export function HudBridge() {
  const setMinutesOfDay = useHudStore((s) => s.setMinutesOfDay);
  const setFps = useHudStore((s) => s.setFps);

  useEffect(() => {
    const onClock = ({ minutesOfDay }: { minutesOfDay: number }) =>
      setMinutesOfDay(minutesOfDay);
    const onFps = ({ fps }: { fps: number }) => setFps(fps);
    gameBus.on("clock", onClock);
    gameBus.on("fps", onFps);
    return () => {
      gameBus.off("clock", onClock);
      gameBus.off("fps", onFps);
    };
  }, [setMinutesOfDay, setFps]);

  return null;
}

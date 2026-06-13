import Phaser from "phaser";

import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { WorldScene } from "./scenes/WorldScene";

/**
 * Creates the Phaser game inside `parent`. Client-only: imported via a dynamic
 * import inside a `next/dynamic({ ssr: false })` component (see GameMount).
 *
 * The 3x pixel zoom is applied on the WorldScene camera (the canonical Phaser
 * approach); the canvas itself fills its parent.
 */
export function createGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#0f1117",
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: "100%",
      height: "100%",
    },
    render: {
      pixelArt: true, // nearest-neighbour + antialias off
      roundPixels: true, // integer positions at render time: no sub-pixel jitter
      maxLights: 16, // the town map registers 10 point lights
    },
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
    scene: [BootScene, PreloadScene, WorldScene],
  });
  // Dev-only handle for E2E/manual checks; stripped from production builds.
  if (process.env.NODE_ENV !== "production") window.__cvGame = game;
  return game;
}

declare global {
  interface Window {
    /** Dev-only handle for E2E checks; never set in production builds. */
    __cvGame?: Phaser.Game;
  }
}

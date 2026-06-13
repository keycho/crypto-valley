import type Phaser from "phaser";

import type { Dir } from "@crypto-valley/shared";

/** LimeZu sheet frame layout (order: right, up, left, down). */
export const RUN_START: Record<Dir, number> = { right: 0, up: 6, left: 12, down: 18 };
export const IDLE_FRAME: Record<Dir, number> = { right: 0, up: 1, left: 2, down: 3 };

/** Create the 4 walk anims for a character sheet (idempotent across restarts). */
export function ensureAvatarAnims(scene: Phaser.Scene, sheet: string): void {
  for (const dir of ["right", "up", "left", "down"] as Dir[]) {
    const key = `${sheet}-walk-${dir}`;
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(`${sheet}_run`, {
        start: RUN_START[dir],
        end: RUN_START[dir] + 5,
      }),
      frameRate: 10,
      repeat: -1,
    });
  }
}

/** Drive a sprite's walk/idle from a sheet + direction + moving flag. */
export function setAvatar(
  sprite: Phaser.GameObjects.Sprite,
  sheet: string,
  dir: Dir,
  moving: boolean,
): void {
  if (moving) {
    sprite.anims.play(`${sheet}-walk-${dir}`, true);
  } else {
    sprite.anims.stop();
    sprite.setTexture(`${sheet}_idle`, IDLE_FRAME[dir]);
  }
}

import Phaser from "phaser";

import type { Dir, SnapEntry } from "@crypto-valley/shared";

import { setAvatar } from "./avatar";

interface Sample {
  t: number;
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
}

const INTERP_DELAY_MS = 100; // render remotes 100ms in the past

/** A networked player rendered from interpolated snapshots, with a name label. */
export class RemotePlayer {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly buffer: Sample[] = [];

  constructor(
    scene: Phaser.Scene,
    readonly id: string,
    name: string,
    readonly sheet: string,
    x: number,
    y: number,
    lit: boolean,
  ) {
    this.sprite = scene.add.sprite(x, y, `${sheet}_idle`, 3).setDepth(y);
    this.shadow = scene.add
      .image(x, y + 15, "soft-shadow")
      .setDisplaySize(14, 6)
      .setAlpha(0.45)
      .setDepth(y - 0.5);
    if (lit) {
      this.sprite.setPipeline("Light2D");
      this.shadow.setPipeline("Light2D");
    }
    // Name label: bright, dark-outlined, always on top, NOT lit (readable at night).
    this.label = scene.add
      .text(x, y - 22, name, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#f2e8d5",
        stroke: "#3a2e26",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setResolution(4)
      .setDepth(2_000_000);
  }

  push(e: SnapEntry, now: number): void {
    this.buffer.push({ t: now, x: e.x, y: e.y, dir: e.dir, moving: e.moving });
    if (this.buffer.length > 12) this.buffer.shift();
  }

  /** Render the remote at (now - 100ms), lerping between the two bracketing samples. */
  interpolate(now: number): void {
    const b = this.buffer;
    if (b.length === 0) return;
    const rt = now - INTERP_DELAY_MS;

    let i = 0;
    while (i < b.length - 1 && b[i + 1].t <= rt) i++;
    const s0 = b[i];
    const s1 = b[Math.min(i + 1, b.length - 1)];

    let x = s1.x;
    let y = s1.y;
    if (s1.t > s0.t && rt > s0.t) {
      const f = Math.min(1, (rt - s0.t) / (s1.t - s0.t));
      x = s0.x + (s1.x - s0.x) * f;
      y = s0.y + (s1.y - s0.y) * f;
    } else if (rt <= s0.t) {
      x = s0.x;
      y = s0.y;
    }

    const rx = Math.round(x);
    const ry = Math.round(y);
    this.sprite.setPosition(rx, ry).setDepth(ry);
    setAvatar(this.sprite, this.sheet, s1.dir, s1.moving);
    this.shadow.setPosition(rx, ry + 15).setDepth(ry - 0.5);
    this.label.setPosition(rx, ry - 22);

    while (b.length > 2 && b[1].t <= rt) b.shift();
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.label.destroy();
  }
}

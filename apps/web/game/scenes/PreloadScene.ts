import { CHARACTER_SHEETS } from "@crypto-valley/shared";
import Phaser from "phaser";

/** Loads the town map + tileset + character sheets behind a loading bar. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("preload");
  }

  preload(): void {
    const { width, height } = this.scale;
    const barW = Math.floor(width / 3);
    const barH = 8;
    const track = this.add
      .rectangle(width / 2, height / 2, barW, barH, 0x2a2d3a)
      .setOrigin(0.5);
    const fill = this.add
      .rectangle(width / 2 - barW / 2, height / 2, 1, barH, 0x5ee6a8)
      .setOrigin(0, 0.5);
    this.load.on("progress", (p: number) => {
      fill.width = Math.max(1, Math.floor(barW * p));
    });
    this.load.on("complete", () => {
      track.destroy();
      fill.destroy();
    });

    this.load.tilemapTiledJSON("town", "/assets/maps/town.tmj");
    this.load.tilemapTiledJSON("farm", "/assets/maps/farm.tmj");
    this.load.image("town_tiles", "/assets/tilesets/town_tiles.png");
    this.load.json("tilesmanifest", "/assets/tilesets/town_tiles.manifest.json");
    // bitberry growth stages 0..4 (16x16)
    this.load.spritesheet("crop_bitberry", "/assets/sprites/crop_bitberry.png", {
      frameWidth: 16,
      frameHeight: 16,
    });
    // LimeZu 16x32 frames; run sheet = 6 frames per direction (R, U, L, D),
    // idle sheet = 1 frame per direction (R, U, L, D). See game/ASSETS.md.
    // All character options are loaded so remote players render with any look.
    for (const sheet of CHARACTER_SHEETS) {
      this.load.spritesheet(`${sheet}_run`, `/assets/characters/${sheet}_run.png`, {
        frameWidth: 16,
        frameHeight: 32,
      });
      this.load.spritesheet(`${sheet}_idle`, `/assets/characters/${sheet}_idle.png`, {
        frameWidth: 16,
        frameHeight: 32,
      });
    }
    // 2-frame civic terminal: 0 = dead screen, 1 = terminal-green (see ASSETS.md).
    this.load.spritesheet("terminal", "/assets/sprites/terminal.png", {
      frameWidth: 32,
      frameHeight: 48,
    });
    // P7 placeable structures: 10 frames (hut..skyscraper, wall/gate/lamp/data),
    // 64×112, bottom-anchored; frame = StructureDef.frame.
    this.load.spritesheet("structures", "/assets/sprites/structures.png", {
      frameWidth: 64,
      frameHeight: 112,
    });
    // unclaimed-plot "for claim" stake.
    this.load.image("plot-stake", "/assets/sprites/plot_stake.png");
    // P6 gather nodes: tree | stump | rock | rubble.
    this.load.spritesheet("gather", "/assets/sprites/gather.png", {
      frameWidth: 32,
      frameHeight: 48,
    });
  }

  create(): void {
    this.scene.start("world");
  }
}

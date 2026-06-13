import Phaser from "phaser";

/** First scene: global render settings, then straight to Preload. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    this.scene.start("preload");
  }
}

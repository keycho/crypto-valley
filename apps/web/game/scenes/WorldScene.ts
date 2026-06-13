import Phaser from "phaser";

import { gameBus } from "../bus";
import {
  CLOCK_START_MINUTES,
  DEPTH_ABOVE,
  DEPTH_PLAYER,
  GAME_MINUTE_MS,
  PLAYER_SPEED,
  ZOOM,
} from "../constants";

type Dir = "right" | "up" | "left" | "down";

/** Frame ranges in the LimeZu sheets (order: right, up, left, down). */
const RUN_START: Record<Dir, number> = { right: 0, up: 6, left: 12, down: 18 };
const IDLE_FRAME: Record<Dir, number> = { right: 0, up: 1, left: 2, down: 3 };

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private facing: Dir = "down";
  private clockAccMs = 0;
  private minutesOfDay = CLOCK_START_MINUTES;
  private fpsAccMs = 0;

  constructor() {
    super("world");
  }

  create(): void {
    const map = this.make.tilemap({ key: "town" });
    const tiles = map.addTilesetImage("town_tiles", "town_tiles");
    if (!tiles) throw new Error("tileset 'town_tiles' missing from map");

    map.createLayer("ground", tiles)?.setDepth(0);
    map.createLayer("ground_detail", tiles)?.setDepth(1);
    // Marker-tile collision layer; authored invisible in the .tmj and kept
    // invisible here — arcade physics collides with it regardless.
    const collision = map.createLayer("collision", tiles);
    if (!collision) throw new Error("collision layer missing from map");
    collision.setVisible(false);
    collision.setCollisionByExclusion([-1]);
    // Canopies / roof overhangs render above the player.
    map.createLayer("above", tiles)?.setDepth(DEPTH_ABOVE);

    // Spawn from the "objects" marker layer.
    const spawn = map.getObjectLayer("objects")?.objects.find((o) => o.name === "spawn");
    const spawnX = spawn?.x ?? map.widthInPixels / 2;
    const spawnY = spawn?.y ?? map.heightInPixels / 2;

    this.player = this.physics.add.sprite(spawnX, spawnY, "adam_idle", IDLE_FRAME.down);
    this.player.setDepth(DEPTH_PLAYER);
    // Feet-only collision box (bottom 8px of the 16x32 sprite).
    this.player.body!.setSize(12, 8);
    (this.player.body as Phaser.Physics.Arcade.Body).setOffset(2, 24);
    this.player.setCollideWorldBounds(true);

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.physics.add.collider(this.player, collision);

    for (const dir of ["right", "up", "left", "down"] as const) {
      this.anims.create({
        key: `walk-${dir}`,
        frames: this.anims.generateFrameNumbers("adam_run", {
          start: RUN_START[dir],
          end: RUN_START[dir] + 5,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }

    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    // startFollow(_, roundPixels=true): integer camera, no sub-pixel shimmer.
    cam.startFollow(this.player, true);

    const kb = this.input.keyboard;
    if (!kb) throw new Error("keyboard plugin unavailable");
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys("W,A,S,D") as WorldScene["wasd"];

    gameBus.emit("clock", { minutesOfDay: this.minutesOfDay });
  }

  override update(_time: number, delta: number): void {
    this.updateMovement();
    this.updateClock(delta);
    this.updateFps(delta);
  }

  private updateMovement(): void {
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    const v = new Phaser.Math.Vector2(
      (right ? 1 : 0) - (left ? 1 : 0),
      (down ? 1 : 0) - (up ? 1 : 0),
    );
    if (v.lengthSq() > 0) v.normalize().scale(PLAYER_SPEED); // normalized diagonals
    this.player.setVelocity(v.x, v.y);

    if (v.lengthSq() > 0) {
      // Face the dominant axis.
      if (Math.abs(v.x) >= Math.abs(v.y)) this.facing = v.x > 0 ? "right" : "left";
      else this.facing = v.y > 0 ? "down" : "up";
      this.player.anims.play(`walk-${this.facing}`, true);
    } else {
      this.player.anims.stop();
      this.player.setTexture("adam_idle", IDLE_FRAME[this.facing]);
    }
  }

  private updateClock(delta: number): void {
    this.clockAccMs += delta;
    while (this.clockAccMs >= GAME_MINUTE_MS) {
      this.clockAccMs -= GAME_MINUTE_MS;
      this.minutesOfDay = (this.minutesOfDay + 1) % (24 * 60);
      gameBus.emit("clock", { minutesOfDay: this.minutesOfDay });
    }
  }

  private updateFps(delta: number): void {
    this.fpsAccMs += delta;
    if (this.fpsAccMs >= 500) {
      this.fpsAccMs = 0;
      gameBus.emit("fps", { fps: Math.round(this.game.loop.actualFps) });
    }
  }
}

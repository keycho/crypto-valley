import Phaser from "phaser";

import { gameBus } from "../bus";
import {
  CLOCK_START_MINUTES,
  DEPTH_ABOVE,
  GAME_MINUTE_MS,
  PLAYER_SPEED,
  zoomFor,
} from "../constants";
import { ambientColorAt, LIGHT_REGISTRY, type LightKind, nightnessAt } from "../dayCurve";

type Dir = "right" | "up" | "left" | "down";

/** Frame ranges in the LimeZu sheets (order: right, up, left, down). */
const RUN_START: Record<Dir, number> = { right: 0, up: 6, left: 12, down: 18 };
const IDLE_FRAME: Record<Dir, number> = { right: 0, up: 1, left: 2, down: 3 };

interface ManagedLight {
  light: Phaser.GameObjects.Light;
  kind: LightKind;
  /** Per-light phase so pulses/flickers don't sync up. */
  phase: number;
}

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private facing: Dir = "down";
  private clockAccMs = 0;
  private minutesOfDay = CLOCK_START_MINUTES;
  private fpsAccMs = 0;
  private elapsedMs = 0;
  private managedLights: ManagedLight[] = [];
  private terminal?: Phaser.GameObjects.Sprite;
  private terminalLit = true;
  private terminalBlinkAt = 0;
  private lightingOn = false;

  constructor() {
    super("world");
  }

  create(): void {
    const map = this.make.tilemap({ key: "town" });
    const tiles = map.addTilesetImage("town_tiles", "town_tiles");
    if (!tiles) throw new Error("tileset 'town_tiles' missing from map");

    // Light2D needs WebGL; in Canvas fallback we keep the unlit pipeline.
    this.lightingOn = this.game.renderer.type === Phaser.WEBGL;

    const ground = map.createLayer("ground", tiles);
    const detail = map.createLayer("ground_detail", tiles);
    const collision = map.createLayer("collision", tiles);
    const above = map.createLayer("above", tiles);
    if (!ground || !detail || !collision || !above) throw new Error("missing tile layer");
    ground.setDepth(0);
    detail.setDepth(1);
    collision.setVisible(false);
    collision.setCollisionByExclusion([-1]);
    above.setDepth(DEPTH_ABOVE);

    // ---- player -------------------------------------------------------------
    const spawn = map.getObjectLayer("objects")?.objects.find((o) => o.name === "spawn");
    this.player = this.physics.add.sprite(
      spawn?.x ?? map.widthInPixels / 2,
      spawn?.y ?? map.heightInPixels / 2,
      "adam_idle",
      IDLE_FRAME.down,
    );
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

    // ---- the plaza terminal (the town's one cold ghost, art bible Law 1) ----
    const termMarker = map
      .getObjectLayer("objects")
      ?.objects.find((o) => o.name === "terminal");
    if (termMarker && termMarker.x !== undefined && termMarker.y !== undefined) {
      this.terminal = this.add.sprite(termMarker.x, termMarker.y, "terminal", 1);
      this.terminal.setOrigin(0.5, 1);
    }

    // ---- lighting (art bible §3) ---------------------------------------------
    if (this.lightingOn) {
      this.lights.enable();
      for (const layer of [ground, detail, above]) layer.setPipeline("Light2D");
      this.player.setPipeline("Light2D");
      this.terminal?.setPipeline("Light2D");

      const lightLayer = map.getObjectLayer("lights");
      for (const o of lightLayer?.objects ?? []) {
        const kindProp = (o.properties as Array<{ name: string; value: string }> | undefined)
          ?.find((p) => p.name === "kind");
        const kind = (kindProp?.value ?? "lamp") as LightKind;
        const def = LIGHT_REGISTRY[kind] ?? LIGHT_REGISTRY.lamp;
        const light = this.lights.addLight(o.x ?? 0, o.y ?? 0, def.radius, def.color, 0);
        this.managedLights.push({ light, kind, phase: ((o.x ?? 0) * 7 + (o.y ?? 0) * 13) % 628 / 100 });
      }
    }

    // ---- camera ---------------------------------------------------------------
    const cam = this.cameras.main;
    cam.setZoom(zoomFor(this.scale.width));
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.startFollow(this.player, true);
    this.scale.on("resize", (size: Phaser.Structs.Size) => {
      cam.setZoom(zoomFor(size.width));
    });

    const kb = this.input.keyboard;
    if (!kb) throw new Error("keyboard plugin unavailable");
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys("W,A,S,D") as WorldScene["wasd"];

    gameBus.emit("clock", { minutesOfDay: this.minutesOfDay });
  }

  override update(_time: number, delta: number): void {
    this.elapsedMs += delta;
    this.updateMovement();
    this.updateClock(delta);
    this.updateLighting();
    this.updateTerminal(delta);
    this.updateFps(delta);
  }

  /** Clock with sub-minute precision for smooth ambient lerping. */
  private minutesFloat(): number {
    return this.minutesOfDay + this.clockAccMs / GAME_MINUTE_MS;
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
    if (v.lengthSq() > 0) v.normalize().scale(PLAYER_SPEED);
    this.player.setVelocity(v.x, v.y);

    if (v.lengthSq() > 0) {
      if (Math.abs(v.x) >= Math.abs(v.y)) this.facing = v.x > 0 ? "right" : "left";
      else this.facing = v.y > 0 ? "down" : "up";
      this.player.anims.play(`walk-${this.facing}`, true);
    } else {
      this.player.anims.stop();
      this.player.setTexture("adam_idle", IDLE_FRAME[this.facing]);
    }

    // y-sort actors between ground_detail (1) and the static above layer.
    this.player.setDepth(this.player.y);
    this.terminal?.setDepth(this.terminal.y);
  }

  private updateClock(delta: number): void {
    this.clockAccMs += delta;
    while (this.clockAccMs >= GAME_MINUTE_MS) {
      this.clockAccMs -= GAME_MINUTE_MS;
      this.minutesOfDay = (this.minutesOfDay + 1) % (24 * 60);
      gameBus.emit("clock", { minutesOfDay: this.minutesOfDay });
    }
  }

  private updateLighting(): void {
    if (!this.lightingOn) return;
    const m = this.minutesFloat();
    this.lights.setAmbientColor(ambientColorAt(m));
    const night = nightnessAt(m);
    const t = this.elapsedMs / 1000;

    for (const ml of this.managedLights) {
      const def = LIGHT_REGISTRY[ml.kind];
      if (def.warm) {
        // Warm sources fade in with darkness and flicker like flame (bible §3.2).
        const flicker = 1 + 0.08 * Math.sin(t * 11 + ml.phase) * Math.sin(t * 5.3 + ml.phase * 2);
        ml.light.setIntensity(def.intensity * night * flicker);
      } else {
        // Living tech breathes: slow sine pulse, ±15%, always on (Law 1's ghost).
        const pulse = 1 + 0.15 * Math.sin((t * 2 * Math.PI) / 4 + ml.phase);
        ml.light.setIntensity(def.intensity * pulse * (0.55 + 0.45 * night));
      }
    }
  }

  /** 2-frame screen flicker: mostly lit, with brief irregular dropouts. */
  private updateTerminal(_delta: number): void {
    if (!this.terminal) return;
    if (this.elapsedMs >= this.terminalBlinkAt) {
      this.terminalLit = !this.terminalLit;
      this.terminal.setFrame(this.terminalLit ? 1 : 0);
      this.terminalBlinkAt =
        this.elapsedMs +
        (this.terminalLit
          ? 900 + Math.random() * 2200 // hold lit
          : 60 + Math.random() * 120); // brief dropout
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

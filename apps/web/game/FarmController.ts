import Phaser from "phaser";

import type { FarmState } from "@crypto-valley/shared";

import { act, fetchState } from "./api";
import { TILE_SIZE } from "./constants";
import { HOTBAR } from "./hotbar";
import { useFarmStore } from "../stores/farm";

const DIR: Record<string, [number, number]> = {
  right: [1, 0],
  left: [-1, 0],
  up: [0, -1],
  down: [0, 1],
};

/**
 * Farm-zone behaviour: renders server soil/crop state, turns input into
 * validated /farm/act calls, and polls so crops visibly grow. All authority is
 * server-side; this only mirrors and requests.
 */
export class FarmController {
  private soil: Phaser.Tilemaps.TilemapLayer;
  private drawnSoil = new Map<string, number>();
  private crops = new Map<string, Phaser.GameObjects.Sprite>();
  private useKey: Phaser.Input.Keyboard.Key;
  private pollAcc = 0;
  private busy = false;

  constructor(
    private scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    tiles: Phaser.Tilemaps.Tileset,
    private gid: (name: string) => number,
    private getActor: () => { tx: number; ty: number; facing: string },
  ) {
    const layer = map.createBlankLayer("soil", tiles);
    if (!layer) throw new Error("could not create soil layer");
    this.soil = layer.setDepth(2);

    const kb = scene.input.keyboard;
    if (!kb) throw new Error("keyboard unavailable");
    // Only the action key lives in the game loop; tool selection + inventory
    // toggle are UI concerns handled in React (see useHotbarKeys).
    this.useKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    const st = useFarmStore.getState().farm;
    if (st) this.render(st);
  }

  update(deltaMs: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.useKey)) void this.use();

    this.pollAcc += deltaMs;
    if (this.pollAcc >= 1500 && !this.busy) {
      this.pollAcc = 0;
      const id = useFarmStore.getState().characterId;
      if (id) {
        void fetchState(id).then((s) => {
          useFarmStore.getState().patch({ farm: s });
          this.render(s);
        });
      }
    }
  }

  private async use(): Promise<void> {
    if (this.busy) return;
    const { characterId, selectedSlot, farm } = useFarmStore.getState();
    if (!characterId) return;
    const { tx: px, ty: py, facing } = this.getActor();
    const [dx, dy] = DIR[facing] ?? [0, 1];
    const x = px + dx;
    const y = py + dy;

    const cropHere = farm?.crops.find((c) => c.x === x && c.y === y);
    const slot = HOTBAR[selectedSlot] ?? HOTBAR[0];
    const action = cropHere?.ready ? "harvest" : slot.action;
    const itemId = action === "plant" ? slot.itemId : undefined;

    // optimistic soil feedback (reconciled from the server response)
    if (action === "hoe") this.soil.putTileAt(this.gid("tilled"), x, y);
    if (action === "water") this.soil.putTileAt(this.gid("tilled_wet"), x, y);

    this.busy = true;
    try {
      const res = await act({ characterId, action, x, y, posX: px, posY: py, itemId });
      if (res.ok && res.state) {
        useFarmStore.getState().patch({ farm: res.state });
        if (res.toast) useFarmStore.getState().notify(res.toast);
        this.render(res.state);
      } else {
        useFarmStore.getState().notify(res.error ?? "blocked");
        const id = useFarmStore.getState().characterId;
        if (id) this.render(await fetchState(id)); // revert optimism
      }
    } finally {
      this.busy = false;
    }
  }

  /** Reconcile soil tiles + crop sprites to authoritative state (diffed). */
  render(state: FarmState): void {
    const wantSoil = new Map<string, number>();
    for (const t of state.tiles) {
      wantSoil.set(`${t.x},${t.y}`, this.gid(t.watered ? "tilled_wet" : "tilled"));
    }
    for (const [key] of this.drawnSoil) {
      if (!wantSoil.has(key)) {
        const [x, y] = key.split(",").map(Number);
        this.soil.removeTileAt(x, y);
      }
    }
    for (const [key, g] of wantSoil) {
      const [x, y] = key.split(",").map(Number);
      this.soil.putTileAt(g, x, y);
    }
    this.drawnSoil = wantSoil;

    const wantCrops = new Set<string>();
    for (const c of state.crops) {
      const key = `${c.x},${c.y}`;
      wantCrops.add(key);
      const frame = Math.min(c.stage, 4);
      let spr = this.crops.get(key);
      if (!spr) {
        spr = this.scene.add
          .sprite(c.x * TILE_SIZE + TILE_SIZE / 2, c.y * TILE_SIZE + TILE_SIZE, "crop_bitberry", frame)
          .setOrigin(0.5, 1);
        this.crops.set(key, spr);
      }
      spr.setFrame(frame);
      spr.setDepth(c.y * TILE_SIZE + TILE_SIZE); // y-sort with the player
    }
    for (const [key, spr] of this.crops) {
      if (!wantCrops.has(key)) {
        spr.destroy();
        this.crops.delete(key);
      }
    }
  }
}

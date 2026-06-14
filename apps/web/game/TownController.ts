import { GATHER_NODE_BY_ID, PLOT_TIERS, plotAt } from "@crypto-valley/content";
import type { WorldAction, WorldState } from "@crypto-valley/shared";
import Phaser from "phaser";

import { fetchWorld, worldAct } from "./api";
import { gameBus } from "./bus";
import { TILE_SIZE } from "./constants";
import { useFarmStore } from "../stores/farm";
import { useMpStore } from "../stores/mp";
import { useWorldStore } from "../stores/world";

const ERRORS: Record<string, string> = {
  ALREADY_OWN_PLOT: "You already own a plot",
  PLOT_TAKEN: "That plot is already claimed",
  NOT_PLOT_OWNER: "Not your plot",
  PLOT_MAX_TIER: "Already a mansion",
  INSUFFICIENT_FUNDS: "Not enough Shards",
  INSUFFICIENT_ITEMS: "Not enough materials",
  INSUFFICIENT_ENERGY: "Too tired",
  NODE_DEPLETED: "Already harvested — it'll regrow",
  OUT_OF_RANGE: "Move closer",
};
const pretty = (e?: string): string => (e ? (ERRORS[e] ?? e) : "Blocked");

/**
 * Town-zone behaviour (P6): renders the server's plots (outline + per-tier
 * building + owner nameplate) and gather nodes, turns Space / HUD buttons into
 * validated /world/act calls, and polls so everyone sees claims + upgrades.
 * Authority is server-side; this only mirrors and requests.
 */
export class TownController {
  private outlines: Phaser.GameObjects.Graphics;
  private buildings = new Map<number, Phaser.GameObjects.Sprite>();
  private buildingShadows = new Map<number, Phaser.GameObjects.Image>();
  private labels = new Map<number, Phaser.GameObjects.Text>();
  private nodes = new Map<string, Phaser.GameObjects.Sprite>();
  private nodeShadows = new Map<string, Phaser.GameObjects.Image>();
  private useKey: Phaser.Input.Keyboard.Key;
  private pollAcc = 0;
  private busy = false;

  private onClaim = ({ index }: { index: number }): void => void this.doAction("claim", index);
  private onUpgrade = ({ index }: { index: number }): void =>
    void this.doAction("upgrade", index);

  constructor(
    private scene: Phaser.Scene,
    private lit: boolean,
    private getActor: () => { tx: number; ty: number },
  ) {
    this.outlines = scene.add.graphics().setDepth(1.5);
    const kb = scene.input.keyboard;
    if (!kb) throw new Error("keyboard unavailable");
    this.useKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    gameBus.on("plotClaim", this.onClaim);
    gameBus.on("plotUpgrade", this.onUpgrade);

    const st = useWorldStore.getState().world;
    if (st) this.render(st);
    void this.refresh();
  }

  destroy(): void {
    gameBus.off("plotClaim", this.onClaim);
    gameBus.off("plotUpgrade", this.onUpgrade);
    this.outlines.destroy();
    for (const m of [this.buildings, this.labels, this.nodes]) {
      for (const o of m.values()) o.destroy();
      m.clear();
    }
    for (const m of [this.buildingShadows, this.nodeShadows]) {
      for (const o of m.values()) o.destroy();
      m.clear();
    }
    useWorldStore.getState().patch({ standingPlot: null, nearNode: null });
  }

  update(deltaMs: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.useKey)) void this.use();
    this.updateProximity();

    this.pollAcc += deltaMs;
    if (this.pollAcc >= 1500 && !this.busy) {
      this.pollAcc = 0;
      void this.refresh();
    }
  }

  /** Tracks which plot the player stands on / node they're near (for the HUD). */
  private updateProximity(): void {
    const { tx, ty } = this.getActor();
    const ws = useWorldStore.getState();
    const sp = plotAt(tx, ty);
    const standingPlot = sp ? sp.index : null;

    let near: { id: string; kind: "tree" | "rock" } | null = null;
    for (const n of ws.world?.nodes ?? []) {
      if (n.available && Math.abs(n.x - tx) <= 1 && Math.abs(n.y - ty) <= 1) {
        near = { id: n.id, kind: n.kind };
        break;
      }
    }
    if (standingPlot !== ws.standingPlot || (near?.id ?? null) !== (ws.nearNode?.id ?? null)) {
      ws.patch({ standingPlot, nearNode: near });
    }
  }

  /** Space: gather an adjacent node, else claim the unclaimed plot underfoot. */
  private async use(): Promise<void> {
    if (this.busy || useMpStore.getState().typing) return;
    const ws = useWorldStore.getState();
    if (ws.nearNode) {
      await this.doAction(ws.nearNode.kind === "tree" ? "chop" : "mine", undefined, ws.nearNode.id);
      return;
    }
    if (ws.standingPlot !== null) {
      const plot = ws.world?.plots.find((p) => p.index === ws.standingPlot);
      if (plot && plot.ownerId === null) await this.doAction("claim", ws.standingPlot);
    }
  }

  private async doAction(
    action: WorldAction["action"],
    plotIndex?: number,
    nodeId?: string,
  ): Promise<void> {
    if (this.busy) return;
    const characterId = useFarmStore.getState().characterId;
    if (!characterId) return;
    const { tx, ty } = this.getActor();
    this.busy = true;
    try {
      const res = await worldAct({ characterId, action, plotIndex, nodeId, posX: tx, posY: ty });
      if (res.ok && res.state) {
        useWorldStore.getState().patch({ world: res.state });
        if (res.toast) useFarmStore.getState().notify(res.toast);
        this.render(res.state);
      } else {
        useFarmStore.getState().notify(pretty(res.error));
      }
    } finally {
      this.busy = false;
    }
  }

  private async refresh(): Promise<void> {
    const characterId = useFarmStore.getState().characterId;
    if (!characterId) return;
    const s = await fetchWorld(characterId);
    useWorldStore.getState().patch({ world: s });
    this.render(s);
  }

  /** Reconcile plot outlines + buildings + nameplates + gather nodes to state. */
  render(state: WorldState): void {
    const me = useFarmStore.getState().characterId;
    this.outlines.clear();

    for (const p of state.plots) {
      const px = p.x * TILE_SIZE;
      const py = p.y * TILE_SIZE;
      const pw = p.w * TILE_SIZE;
      const ph = p.h * TILE_SIZE;
      const mine = p.ownerId !== null && p.ownerId === me;
      const color = p.ownerId === null ? 0xc8a06b : mine ? 0x34d399 : 0x8c8276;
      if (p.ownerId === null) {
        this.outlines.fillStyle(color, 0.06);
        this.outlines.fillRect(px + 1, py + 1, pw - 2, ph - 2);
      }
      this.outlines.lineStyle(1, color, p.ownerId === null ? 0.9 : 0.7);
      this.outlines.strokeRect(px + 1, py + 1, pw - 2, ph - 2);

      const ax = px + pw / 2;
      const ay = py + ph;
      let spr = this.buildings.get(p.index);
      if (!spr) {
        spr = this.scene.add.sprite(ax, ay, "plots", p.tier).setOrigin(0.5, 1);
        if (this.lit) spr.setPipeline("Light2D");
        this.buildings.set(p.index, spr);
        const sh = this.scene.add
          .image(ax, ay - 2, "soft-shadow")
          .setDisplaySize(pw * 0.7, 12)
          .setAlpha(0.4)
          .setDepth(2);
        this.buildingShadows.set(p.index, sh);
      }
      spr.setFrame(p.tier).setDepth(ay);

      if (p.ownerId !== null) {
        const text = `${p.ownerName ?? "?"}\n${PLOT_TIERS[p.tier]?.name ?? ""}`;
        let lbl = this.labels.get(p.index);
        if (!lbl) {
          lbl = this.makeLabel(ax, py);
          this.labels.set(p.index, lbl);
        }
        lbl.setText(text).setPosition(ax, py - 1).setVisible(true);
      } else {
        this.labels.get(p.index)?.setVisible(false);
      }
    }

    for (const n of state.nodes) {
      const ax = n.x * TILE_SIZE + TILE_SIZE / 2;
      const ay = n.y * TILE_SIZE + TILE_SIZE;
      const frame = n.kind === "tree" ? (n.available ? 0 : 1) : n.available ? 2 : 3;
      let spr = this.nodes.get(n.id);
      if (!spr) {
        spr = this.scene.add.sprite(ax, ay, "gather", frame).setOrigin(0.5, 1);
        if (this.lit) spr.setPipeline("Light2D");
        this.nodes.set(n.id, spr);
        const sh = this.scene.add
          .image(ax, ay - 1, "soft-shadow")
          .setDisplaySize(20, 7)
          .setAlpha(0.35)
          .setDepth(2);
        this.nodeShadows.set(n.id, sh);
      }
      spr.setFrame(frame).setDepth(ay);
      // keep the lookup honest (dev assert): every node id must be known content
      if (!GATHER_NODE_BY_ID[n.id]) spr.setVisible(false);
    }
  }

  private makeLabel(x: number, y: number): Phaser.GameObjects.Text {
    return this.scene.add
      .text(x, y, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#f2e8d5",
        align: "center",
        backgroundColor: "rgba(26,18,12,0.55)",
        padding: { x: 2, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setResolution(4)
      .setDepth(1_500_000);
  }
}

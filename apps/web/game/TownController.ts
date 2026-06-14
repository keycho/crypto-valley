import { GATHER_NODE_BY_ID, plotAt, STRUCTURE_BY_ID } from "@crypto-valley/content";
import type { WorldAction, WorldState } from "@crypto-valley/shared";
import Phaser from "phaser";

import { fetchWorld, worldAct } from "./api";
import { gameBus } from "./bus";
import { TILE_SIZE } from "./constants";
import { useBuildStore } from "../stores/build";
import { useFarmStore } from "../stores/farm";
import { useMpStore } from "../stores/mp";
import { useQuestUi } from "../stores/questUi";
import { useWorldStore } from "../stores/world";

const ERRORS: Record<string, string> = {
  ALREADY_OWN_PLOT: "You already own a plot",
  PLOT_TAKEN: "That plot is already claimed",
  NOT_PLOT_OWNER: "Not your structure",
  NO_PLOT: "Claim a plot first",
  OUT_OF_BOUNDS: "Must sit inside your plot",
  OVERLAP: "Overlaps another structure",
  STRUCTURE_MAX_TIER: "Already maxed out",
  STRUCTURE_STALE: "It just changed — try again",
  INSUFFICIENT_FUNDS: "Not enough Shards",
  INSUFFICIENT_ITEMS: "Not enough materials",
  INSUFFICIENT_ENERGY: "Too tired",
  NODE_DEPLETED: "Already harvested — it'll regrow",
  OUT_OF_RANGE: "Move closer",
};
const pretty = (e?: string): string => (e ? (ERRORS[e] ?? e) : "Blocked");

const COLOR_UNCLAIMED = 0xc8a06b;
const COLOR_MINE = 0x34d399;
const COLOR_OTHER = 0x8c8276;
const GHOST_OK = 0x6fe39a;
const GHOST_BAD = 0xff7a7a;
const SELECT_HL = 0xffd98a;

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
}

/**
 * Town-zone behaviour (P7): renders plots + free-form structures + gather nodes,
 * runs build mode (a ghost preview + click-to-place on your own plot), and turns
 * Space / HUD buttons / clicks into server-validated /world/act calls. Polls so
 * everyone sees placements + upgrades. Authority is server-side.
 */
export class TownController {
  private outlines: Phaser.GameObjects.Graphics; // plot borders (on render)
  private uiGfx: Phaser.GameObjects.Graphics; // ghost / selection (every frame)
  private gatherGfx: Phaser.GameObjects.Graphics; // gather-node affordance rings
  private gatherPing: Phaser.GameObjects.Text; // "nearest wood" hint
  private ghost: Phaser.GameObjects.Sprite;
  private stakes = new Map<number, Phaser.GameObjects.Image>();
  private labels = new Map<number, Phaser.GameObjects.Text>();
  private structures = new Map<string, Phaser.GameObjects.Sprite>();
  private structShadows = new Map<string, Phaser.GameObjects.Image>();
  private nodes = new Map<string, Phaser.GameObjects.Sprite>();
  private nodeShadows = new Map<string, Phaser.GameObjects.Image>();
  private useKey: Phaser.Input.Keyboard.Key;
  private escKey: Phaser.Input.Keyboard.Key;
  private questKey: Phaser.Input.Keyboard.Key;
  private pollAcc = 0;
  private busy = false;

  private onClaim = ({ index }: { index: number }): void => this.claim(index);
  private onUpgrade = ({ id }: { id: string }): void => {
    const characterId = useFarmStore.getState().characterId;
    if (characterId) void this.send({ action: "upgrade", characterId, structureId: id });
  };
  private onRemove = ({ id }: { id: string }): void => {
    const characterId = useFarmStore.getState().characterId;
    if (characterId) void this.send({ action: "remove", characterId, structureId: id });
  };
  private onQuestClaim = ({ id }: { id: string }): void => {
    const characterId = useFarmStore.getState().characterId;
    if (characterId) void this.send({ action: "claimQuest", characterId, questId: id });
  };
  private onPointerDown = (pointer: Phaser.Input.Pointer): void => this.handleClick(pointer);

  constructor(
    private scene: Phaser.Scene,
    private lit: boolean,
    private getActor: () => { tx: number; ty: number },
  ) {
    this.outlines = scene.add.graphics().setDepth(1.5);
    this.uiGfx = scene.add.graphics().setDepth(1.6);
    this.gatherGfx = scene.add.graphics().setDepth(2.5);
    this.gatherPing = scene.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#0b140f",
        backgroundColor: "#ffd98a",
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setResolution(4)
      .setDepth(1_500_001)
      .setVisible(false);
    this.ghost = scene.add.sprite(0, 0, "structures", 0).setOrigin(0.5, 1).setAlpha(0.55).setVisible(false);
    this.ghost.setDepth(1_400_000);

    const kb = scene.input.keyboard;
    if (!kb) throw new Error("keyboard unavailable");
    this.useKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.escKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.questKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    gameBus.on("plotClaim", this.onClaim);
    gameBus.on("structureUpgrade", this.onUpgrade);
    gameBus.on("structureRemove", this.onRemove);
    gameBus.on("questClaim", this.onQuestClaim);
    scene.input.on("pointerdown", this.onPointerDown);

    const st = useWorldStore.getState().world;
    if (st) this.render(st);
    void this.refresh();
  }

  destroy(): void {
    gameBus.off("plotClaim", this.onClaim);
    gameBus.off("structureUpgrade", this.onUpgrade);
    gameBus.off("structureRemove", this.onRemove);
    gameBus.off("questClaim", this.onQuestClaim);
    this.scene.input.off("pointerdown", this.onPointerDown);
    this.outlines.destroy();
    this.uiGfx.destroy();
    this.gatherGfx.destroy();
    this.gatherPing.destroy();
    this.ghost.destroy();
    for (const m of [this.stakes, this.labels, this.structures, this.structShadows, this.nodes, this.nodeShadows]) {
      for (const o of m.values()) o.destroy();
      m.clear();
    }
    useWorldStore.getState().patch({ standingPlot: null, nearNode: null });
    useBuildStore.getState().setBuildMode(false);
  }

  update(deltaMs: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.useKey)) void this.use();
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      const b = useBuildStore.getState();
      if (b.buildMode) b.setBuildMode(false);
      else if (b.selectedStructureId) b.selectStructure(null);
      else useQuestUi.getState().set(false);
    }
    if (Phaser.Input.Keyboard.JustDown(this.questKey) && !useMpStore.getState().typing) {
      useQuestUi.getState().toggle();
    }
    this.updateProximity();
    this.drawUiOverlay();
    this.drawGatherHints();

    this.pollAcc += deltaMs;
    if (this.pollAcc >= 1500 && !this.busy) {
      this.pollAcc = 0;
      void this.refresh();
    }
  }

  // ----------------------------------------------------- proximity (Space HUD)
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
      const characterId = useFarmStore.getState().characterId;
      const { tx, ty } = this.getActor();
      const { id: nodeId, kind } = ws.nearNode;
      if (characterId) {
        await this.send(
          kind === "tree"
            ? { action: "chop", characterId, nodeId, posX: tx, posY: ty }
            : { action: "mine", characterId, nodeId, posX: tx, posY: ty },
        );
      }
      return;
    }
    if (ws.standingPlot !== null) {
      const plot = ws.world?.plots.find((p) => p.index === ws.standingPlot);
      if (plot && plot.ownerId === null) this.claim(ws.standingPlot);
    }
  }

  private claim(index: number): void {
    const characterId = useFarmStore.getState().characterId;
    if (!characterId) return;
    const { tx, ty } = this.getActor();
    void this.send({ action: "claim", characterId, plotIndex: index, posX: tx, posY: ty });
  }

  // -------------------------------------------------------- pointer: build/select
  private pointerTile(pointer: Phaser.Input.Pointer): { tx: number; ty: number } {
    const wp = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    return { tx: Math.floor(wp.x / TILE_SIZE), ty: Math.floor(wp.y / TILE_SIZE) };
  }

  /** Mirrors the server: a placement is valid on my plot, in bounds, not overlapping, affordable. */
  private placeable(tx: number, ty: number, defId: string): boolean {
    const world = useWorldStore.getState().world;
    if (!world || world.me.ownedPlot === null) return false;
    const def = STRUCTURE_BY_ID[defId];
    if (!def) return false;
    const plot = world.plots.find((p) => p.index === world.me.ownedPlot);
    if (!plot) return false;
    const { w, h } = def.footprint;
    if (tx < plot.x || ty < plot.y || tx + w > plot.x + plot.w || ty + h > plot.y + plot.h) {
      return false;
    }
    for (const s of world.structures) {
      if (s.plotIndex === plot.index && rectsOverlap(tx, ty, w, h, s.x, s.y, s.w, s.h)) return false;
    }
    return (
      world.me.wood >= def.cost.wood &&
      world.me.stone >= def.cost.stone &&
      world.me.shards >= def.cost.shards
    );
  }

  private handleClick(pointer: Phaser.Input.Pointer): void {
    if (pointer.button !== 0) return;
    const build = useBuildStore.getState();
    const { tx, ty } = this.pointerTile(pointer);

    if (build.buildMode && build.selectedDef) {
      if (!this.placeable(tx, ty, build.selectedDef)) {
        useFarmStore.getState().notify(this.placeReason(tx, ty, build.selectedDef));
        return;
      }
      const characterId = useFarmStore.getState().characterId;
      if (characterId) {
        void this.send({ action: "place", characterId, defId: build.selectedDef, x: tx, y: ty, rotation: 0 });
      }
      return;
    }
    // select an owned structure under the cursor (to upgrade / remove)
    const world = useWorldStore.getState().world;
    const me = useFarmStore.getState().characterId;
    const hit = world?.structures.find(
      (s) =>
        tx >= s.x && tx < s.x + s.w && ty >= s.y && ty < s.y + s.h &&
        world.plots.find((p) => p.index === s.plotIndex)?.ownerId === me,
    );
    build.selectStructure(hit ? hit.id : null);
  }

  private placeReason(tx: number, ty: number, defId: string): string {
    const world = useWorldStore.getState().world;
    const def = STRUCTURE_BY_ID[defId];
    if (!world || !def) return "Can't build there";
    if (world.me.ownedPlot === null) return "Claim a plot first";
    if (world.me.wood < def.cost.wood || world.me.stone < def.cost.stone || world.me.shards < def.cost.shards) {
      return "Not enough materials";
    }
    return "Can't build there";
  }

  // ---------------------------------------------------------- per-frame overlay
  private drawUiOverlay(): void {
    this.uiGfx.clear();
    const build = useBuildStore.getState();

    if (build.buildMode && build.selectedDef) {
      const def = STRUCTURE_BY_ID[build.selectedDef];
      const { tx, ty } = this.pointerTile(this.scene.input.activePointer);
      if (def) {
        const ok = this.placeable(tx, ty, build.selectedDef);
        const { w, h } = def.footprint;
        this.uiGfx.fillStyle(ok ? GHOST_OK : GHOST_BAD, 0.18);
        this.uiGfx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, w * TILE_SIZE, h * TILE_SIZE);
        this.uiGfx.lineStyle(1, ok ? GHOST_OK : GHOST_BAD, 0.95);
        this.uiGfx.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, w * TILE_SIZE, h * TILE_SIZE);
        const ax = (tx + w / 2) * TILE_SIZE;
        const ay = (ty + h) * TILE_SIZE;
        this.ghost.setFrame(def.frame).setPosition(ax, ay).setDepth(ay).setTint(ok ? GHOST_OK : GHOST_BAD).setVisible(true);
      }
      return;
    }
    this.ghost.setVisible(false);

    // highlight a selected structure (inspect mode)
    if (build.selectedStructureId) {
      const s = useWorldStore.getState().world?.structures.find((x) => x.id === build.selectedStructureId);
      if (s) {
        this.uiGfx.lineStyle(1.5, SELECT_HL, 1);
        this.uiGfx.strokeRect(s.x * TILE_SIZE, s.y * TILE_SIZE, s.w * TILE_SIZE, s.h * TILE_SIZE);
      }
    }
  }

  /**
   * Gather affordance: a warm "interactable" ring on every available node (so a
   * choppable tree reads differently from baked decoration), plus a brighter ring
   * + a "Wood" ping on the nearest tree while a wood quest is active — so a brand-
   * new player following the Timber quest can find wood in seconds.
   */
  private drawGatherHints(): void {
    this.gatherGfx.clear();
    const world = useWorldStore.getState().world;
    if (!world) {
      this.gatherPing.setVisible(false);
      return;
    }
    const t = this.scene.time.now;
    const pulse = 0.5 + 0.5 * Math.sin(t / 350);
    for (const n of world.nodes) {
      if (!n.available) continue;
      const cx = n.x * TILE_SIZE + TILE_SIZE / 2;
      const by = n.y * TILE_SIZE + TILE_SIZE;
      this.gatherGfx.lineStyle(1.5, 0xf2c879, 0.45 + 0.2 * pulse);
      this.gatherGfx.strokeEllipse(cx, by - 2, 18, 8);
    }

    const woodQuest = world.quests.some(
      (q) => (q.id === "q2_timber" || q.id === "daily_wood") && q.status === "active",
    );
    if (woodQuest) {
      const { tx, ty } = this.getActor();
      let best: { x: number; y: number } | null = null;
      let bestD = Infinity;
      for (const n of world.nodes) {
        if (n.kind !== "tree" || !n.available) continue;
        const d = Math.abs(n.x - tx) + Math.abs(n.y - ty);
        if (d < bestD) {
          bestD = d;
          best = { x: n.x, y: n.y };
        }
      }
      if (best && bestD > 1) {
        const cx = best.x * TILE_SIZE + TILE_SIZE / 2;
        const by = best.y * TILE_SIZE + TILE_SIZE;
        this.gatherGfx.lineStyle(2, 0xffd98a, 0.85);
        this.gatherGfx.strokeEllipse(cx, by - 2, 22, 10);
        const bounce = Math.round(2 * Math.sin(t / 220));
        this.gatherPing.setText("Wood ↓").setPosition(cx, best.y * TILE_SIZE - 6 + bounce).setVisible(true);
        return;
      }
    }
    this.gatherPing.setVisible(false);
  }

  // ------------------------------------------------------------- server round-trip
  private async send(action: WorldAction): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const res = await worldAct(action);
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

  // ----------------------------------------------------------------- render
  render(state: WorldState): void {
    const me = useFarmStore.getState().characterId;
    this.outlines.clear();

    for (const p of state.plots) {
      const px = p.x * TILE_SIZE;
      const py = p.y * TILE_SIZE;
      const pw = p.w * TILE_SIZE;
      const ph = p.h * TILE_SIZE;
      const mine = p.ownerId !== null && p.ownerId === me;
      const color = p.ownerId === null ? COLOR_UNCLAIMED : mine ? COLOR_MINE : COLOR_OTHER;
      if (p.ownerId === null) {
        this.outlines.fillStyle(color, 0.06);
        this.outlines.fillRect(px + 1, py + 1, pw - 2, ph - 2);
      }
      this.outlines.lineStyle(1, color, p.ownerId === null ? 0.9 : 0.7);
      this.outlines.strokeRect(px + 1, py + 1, pw - 2, ph - 2);

      const cx = px + pw / 2;
      if (p.ownerId === null) {
        let st = this.stakes.get(p.index);
        if (!st) {
          st = this.scene.add.image(cx, py + ph / 2 + 8, "plot-stake").setOrigin(0.5, 1);
          if (this.lit) st.setPipeline("Light2D");
          st.setDepth(py + ph / 2 + 8);
          this.stakes.set(p.index, st);
        }
        st.setVisible(true);
        this.labels.get(p.index)?.setVisible(false);
      } else {
        this.stakes.get(p.index)?.setVisible(false);
        let lbl = this.labels.get(p.index);
        if (!lbl) {
          lbl = this.makeLabel(cx, py);
          this.labels.set(p.index, lbl);
        }
        lbl.setText(mine ? "Your plot" : (p.ownerName ?? "Claimed")).setPosition(cx, py - 1).setVisible(true);
      }
    }

    // structures (reconcile against state)
    const seen = new Set<string>();
    for (const s of state.structures) {
      seen.add(s.id);
      const def = STRUCTURE_BY_ID[s.defId];
      if (!def) continue;
      const ax = (s.x + s.w / 2) * TILE_SIZE;
      const ay = (s.y + s.h) * TILE_SIZE;
      let spr = this.structures.get(s.id);
      if (!spr) {
        spr = this.scene.add.sprite(ax, ay, "structures", def.frame).setOrigin(0.5, 1);
        if (this.lit) spr.setPipeline("Light2D");
        this.structures.set(s.id, spr);
        const sh = this.scene.add
          .image(ax, ay - 1, "soft-shadow")
          .setDisplaySize(s.w * TILE_SIZE * 0.8, 9)
          .setAlpha(0.38)
          .setDepth(2);
        this.structShadows.set(s.id, sh);
      }
      spr.setFrame(def.frame).setPosition(ax, ay).setDepth(ay);
    }
    for (const [id, spr] of this.structures) {
      if (seen.has(id)) continue;
      spr.destroy();
      this.structShadows.get(id)?.destroy();
      this.structures.delete(id);
      this.structShadows.delete(id);
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

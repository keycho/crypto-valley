import { describe, expect, it } from "vitest";

import { GATHER_NODES, nodeAvailable, PLOT_H, PLOT_W, PLOTS, plotAt } from "./plots";

describe("plots content", () => {
  it("plot indices are 0..n-1 and unique", () => {
    PLOTS.forEach((p, i) => expect(p.index).toBe(i));
    expect(new Set(PLOTS.map((p) => p.index)).size).toBe(PLOTS.length);
  });

  it("plots never overlap (with a 1-tile walking gap)", () => {
    for (let i = 0; i < PLOTS.length; i++) {
      for (let j = i + 1; j < PLOTS.length; j++) {
        const a = PLOTS[i];
        const b = PLOTS[j];
        const sep =
          a.x + PLOT_W < b.x ||
          b.x + PLOT_W < a.x ||
          a.y + PLOT_H < b.y ||
          b.y + PLOT_H < a.y;
        expect(sep, `plot ${i} overlaps plot ${j}`).toBe(true);
      }
    }
  });

  it("plotAt finds the containing plot and nothing outside", () => {
    const p = PLOTS[0];
    expect(plotAt(p.x, p.y)?.index).toBe(0);
    expect(plotAt(p.x + PLOT_W - 1, p.y + PLOT_H - 1)?.index).toBe(0);
    expect(plotAt(p.x - 1, p.y)).toBeNull();
    expect(plotAt(p.x + PLOT_W, p.y)).toBeNull();
  });

  it("gather node ids are unique", () => {
    expect(new Set(GATHER_NODES.map((n) => n.id)).size).toBe(GATHER_NODES.length);
  });

  it("nodeAvailable: fresh, depleted, and respawned", () => {
    const respawn = 1000;
    expect(nodeAvailable(null, 5000, respawn)).toBe(true); // never harvested
    expect(nodeAvailable(5000, 5500, respawn)).toBe(false); // within window
    expect(nodeAvailable(5000, 6000, respawn)).toBe(true); // respawned
  });
});

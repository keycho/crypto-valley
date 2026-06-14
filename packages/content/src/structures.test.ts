import { describe, expect, it } from "vitest";

import {
  nextStructure,
  PLACEABLE_STRUCTURES,
  STRUCTURE_BY_ID,
  STRUCTURE_DEFS,
  structureRefund,
} from "./structures";

describe("structures content", () => {
  it("def ids and frames are unique", () => {
    expect(new Set(STRUCTURE_DEFS.map((d) => d.id)).size).toBe(STRUCTURE_DEFS.length);
    expect(new Set(STRUCTURE_DEFS.map((d) => d.frame)).size).toBe(STRUCTURE_DEFS.length);
  });

  it("the building chain hut→skyscraper links up and escalates in cost + tier", () => {
    let def = STRUCTURE_BY_ID.hut;
    const chain = ["hut"];
    while (def.nextTier) {
      const next = nextStructure(def.id);
      expect(next, `${def.id} -> ${def.nextTier}`).not.toBeNull();
      // tier strictly increases, cost strictly increases
      expect(next!.tier).toBe(def.tier + 1);
      const cur = def.cost.wood + def.cost.stone + def.cost.shards;
      const nxt = next!.cost.wood + next!.cost.stone + next!.cost.shards;
      expect(nxt).toBeGreaterThan(cur);
      def = next!;
      chain.push(def.id);
    }
    expect(chain).toEqual(["hut", "cabin", "house", "tower", "high_rise", "skyscraper"]);
    expect(nextStructure("skyscraper")).toBeNull();
  });

  it("nextStructure on a standalone or unknown id is null", () => {
    expect(nextStructure("wall")).toBeNull();
    expect(nextStructure("nope")).toBeNull();
  });

  it("palette = only placeable defs (hut + standalones, not upgrade-only tiers)", () => {
    const ids = PLACEABLE_STRUCTURES.map((d) => d.id);
    expect(ids).toContain("hut");
    expect(ids).toContain("wall");
    expect(ids).not.toContain("cabin"); // reached only by upgrading
    expect(ids).not.toContain("skyscraper");
    expect(PLACEABLE_STRUCTURES.every((d) => d.placeable)).toBe(true);
  });

  it("refund is a non-negative fraction below the build cost", () => {
    for (const d of STRUCTURE_DEFS) {
      const r = structureRefund(d);
      expect(r.wood).toBeGreaterThanOrEqual(0);
      expect(r.wood).toBeLessThanOrEqual(d.cost.wood);
      expect(r.shards).toBeLessThanOrEqual(d.cost.shards);
    }
  });
});

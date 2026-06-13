import { describe, expect, it } from "vitest";

import { bankGrowth, cropStage, type CropDef, type CropState } from "./crops";
import { ACTION_ENERGY, regenEnergy } from "./energy";

const DEF: CropDef = { stages: 4, msPerStage: 1000, seasons: [0, 1, 2, 3] };

describe("cropStage", () => {
  it("does not grow while unwatered", () => {
    const c: CropState = { plantedAt: 0, wateredUntil: null, growthCreditMs: 0 };
    expect(cropStage(c, DEF, 10_000, 0, 4000).stage).toBe(0);
  });

  it("advances stages with watered time and becomes ready at the last stage", () => {
    // watered window [0, 4000); waterMs 4000 -> windowStart 0
    const c: CropState = { plantedAt: 0, wateredUntil: 4000, growthCreditMs: 0 };
    expect(cropStage(c, DEF, 0, 0, 4000).stage).toBe(0);
    expect(cropStage(c, DEF, 2500, 0, 4000).stage).toBe(2);
    const ripe = cropStage(c, DEF, 4000, 0, 4000);
    expect(ripe.stage).toBe(4);
    expect(ripe.ready).toBe(true);
  });

  it("pauses growth when the watering expires (caps at the window)", () => {
    const c: CropState = { plantedAt: 0, wateredUntil: 2000, growthCreditMs: 0 };
    // beyond wateredUntil, credit is capped at 2000ms -> stage 2, not 4
    expect(cropStage(c, DEF, 9999, 0, 2000).stage).toBe(2);
  });

  it("is deterministic: identical inputs => identical output", () => {
    const c: CropState = { plantedAt: 0, wateredUntil: 4000, growthCreditMs: 500 };
    expect(cropStage(c, DEF, 3210, 1, 4000)).toEqual(cropStage(c, DEF, 3210, 1, 4000));
  });

  it("withers out of season before maturity, survives in season", () => {
    const seasonal: CropDef = { stages: 4, msPerStage: 1000, seasons: [3] };
    const young: CropState = { plantedAt: 0, wateredUntil: 1500, growthCreditMs: 0 };
    expect(cropStage(young, seasonal, 1000, 0, 1500).dead).toBe(true);
    expect(cropStage(young, seasonal, 1000, 3, 1500).dead).toBe(false);
  });
});

describe("bankGrowth", () => {
  it("banks the credit accrued in the current window and never double-counts", () => {
    // first watering at t=0 lasts to 4000
    const planted: CropState = { plantedAt: 0, wateredUntil: 4000, growthCreditMs: 0 };
    // re-water at t=3000: bank 3000ms of credit
    const banked = bankGrowth(planted, 3000, 4000);
    expect(banked).toBe(3000);
    // continuing from the new window starting at 3000 keeps total monotonic
    const next: CropState = { plantedAt: 0, wateredUntil: 3000 + 4000, growthCreditMs: banked };
    expect(cropStage(next, DEF, 3000, 0, 4000).creditMs).toBe(3000);
    expect(cropStage(next, DEF, 5000, 0, 4000).creditMs).toBe(5000);
  });
});

describe("regenEnergy", () => {
  it("regenerates one point per regen interval, capped at max", () => {
    expect(regenEnergy(50, 0, 0)).toBe(50);
    expect(regenEnergy(50, 0, 36_000)).toBe(51);
    expect(regenEnergy(50, 0, 36_000 * 10)).toBe(60);
    expect(regenEnergy(99, 0, 36_000 * 100)).toBe(100);
  });

  it("exposes action costs", () => {
    expect(ACTION_ENERGY.hoe).toBe(2);
    expect(ACTION_ENERGY.water).toBe(1);
  });
});

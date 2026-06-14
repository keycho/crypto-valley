import { describe, expect, it } from "vitest";

import { computePrizes, PORTFOLIO_POOL_SHARE, PROFIT_POOL_SHARE, trophyTitle } from "./seasons";

describe("season prizes", () => {
  it("splits the pool 70/30 across boards, then 50/30/20 across ranks", () => {
    const p = computePrizes(1000);
    expect(p.profit).toEqual([350, 210, 140]); // floor(700)*[.5,.3,.2]
    expect(p.portfolio).toEqual([150, 90, 60]); // floor(300)*[.5,.3,.2]
  });

  it("never pays out more than the pool (flooring keeps a little in the treasury)", () => {
    for (const pool of [0, 1, 37, 999, 100000]) {
      const p = computePrizes(pool);
      const total = [...p.profit, ...p.portfolio].reduce((s, x) => s + x, 0);
      expect(total).toBeLessThanOrEqual(pool);
      expect(p.profit.every((x) => x >= 0)).toBe(true);
    }
  });

  it("an empty pool pays nothing", () => {
    expect(computePrizes(0)).toEqual({ profit: [0, 0, 0], portfolio: [0, 0, 0] });
  });

  it("board shares sum to 1", () => {
    expect(PROFIT_POOL_SHARE + PORTFOLIO_POOL_SHARE).toBeCloseTo(1);
  });

  it("trophy titles read right", () => {
    expect(trophyTitle(3, "profit", 1)).toBe("Season 3 Champion");
    expect(trophyTitle(3, "portfolio", 1)).toBe("Season 3 Top Builder");
    expect(trophyTitle(2, "profit", 2)).toContain("Season 2");
  });
});

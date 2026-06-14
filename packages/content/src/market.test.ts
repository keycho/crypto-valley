import { describe, expect, it } from "vitest";

import { MARKET_FEE_BPS, marketFee, MAX_PLOTS, sellerProceeds } from "./market";

describe("market config", () => {
  it("the plot cap is 8", () => {
    expect(MAX_PLOTS).toBe(8);
  });

  it("fee is a floored % of price; seller nets the rest", () => {
    expect(MARKET_FEE_BPS).toBe(500); // 5%
    expect(marketFee(100)).toBe(5);
    expect(marketFee(200)).toBe(10);
    expect(marketFee(1)).toBe(0); // floor(0.05) = 0
    expect(marketFee(199)).toBe(9); // floor(9.95)
    expect(sellerProceeds(100)).toBe(95);
    expect(marketFee(100) + sellerProceeds(100)).toBe(100); // fee + proceeds == price
  });
});

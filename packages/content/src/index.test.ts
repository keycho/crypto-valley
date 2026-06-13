import { describe, expect, it } from "vitest";

import { ITEMS } from "./items";
import { validateCatalog } from "./validate";

describe("content catalog", () => {
  it("ships a starter catalog", () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(18);
  });

  it("validates with no errors (every meta item reference exists)", () => {
    expect(validateCatalog(ITEMS)).toEqual([]);
  });

  it("flags a dangling meta reference", () => {
    const broken = [
      ...ITEMS,
      {
        id: "broken_seed",
        category: "seed" as const,
        stackMax: 1,
        baseValue: 1,
        tradeable: true,
        mintable: false,
        meta: { crop: "crop_does_not_exist" },
      },
    ];
    expect(validateCatalog(broken)).toContain(
      'item broken_seed: meta.crop references unknown item "crop_does_not_exist"',
    );
  });
});

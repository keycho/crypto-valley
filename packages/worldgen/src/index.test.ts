import { describe, expect, it } from "vitest";

import { hashSeed } from "./index";

describe("worldgen placeholder", () => {
  it("is deterministic for a given seed", () => {
    expect(hashSeed("crypto-valley")).toBe(hashSeed("crypto-valley"));
  });

  it("produces different output for different seeds", () => {
    expect(hashSeed("seed-a")).not.toBe(hashSeed("seed-b"));
  });
});

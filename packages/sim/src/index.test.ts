import { describe, expect, it } from "vitest";

import { add } from "./index";

describe("sim placeholder", () => {
  it("computes the expected result", () => {
    expect(add(2, 3)).toBe(5);
  });

  it("is deterministic: same inputs => same output", () => {
    expect(add(2, 3)).toBe(add(2, 3));
  });
});

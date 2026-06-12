import { describe, expect, it } from "vitest";

import { CONTENT_VERSION } from "./index";

describe("content placeholder", () => {
  it("exposes a content version", () => {
    expect(CONTENT_VERSION).toBe("0.0.0");
  });
});

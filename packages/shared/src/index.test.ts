import { describe, expect, it } from "vitest";

import { makePong, PingMessageSchema } from "./index";

describe("ping protocol", () => {
  it("accepts a valid ping message", () => {
    expect(PingMessageSchema.safeParse({ t: "ping" }).success).toBe(true);
  });

  it("rejects anything that is not a ping", () => {
    expect(PingMessageSchema.safeParse({ t: "pong" }).success).toBe(false);
    expect(PingMessageSchema.safeParse({}).success).toBe(false);
  });

  it("builds a pong reply", () => {
    expect(makePong()).toEqual({ t: "pong" });
  });
});

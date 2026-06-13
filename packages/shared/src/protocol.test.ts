import { describe, expect, it } from "vitest";

import { parseCollision, isMoveLegal, type TmjMap } from "./collision";
import {
  type C2S,
  decodeC2S,
  decodeS2C,
  encodeMsg,
  PROTOCOL_VERSION,
  type S2C,
} from "./protocol";

describe("protocol msgpack round-trip", () => {
  it("encodes + decodes a move (C2S)", () => {
    const move: C2S = { t: "move", seq: 5, x: 100, y: 200, dir: "left", moving: true };
    expect(decodeC2S(encodeMsg(move))).toEqual(move);
  });

  it("encodes + decodes a welcome (S2C)", () => {
    const welcome: S2C = {
      t: "welcome",
      v: PROTOCOL_VERSION,
      youId: "c1",
      tick: 0,
      players: [{ id: "c1", name: "Ada", appearance: { sheet: "adam" }, x: 0, y: 0, dir: "down", moving: false }],
    };
    expect(decodeS2C(encodeMsg(welcome))).toEqual(welcome);
  });

  it("rejects malformed / mistyped messages as null", () => {
    expect(decodeC2S(new Uint8Array([0xff, 0x00, 0x42, 0x99]))).toBeNull();
    expect(decodeC2S(encodeMsg({ t: "chat", msg: "" } as unknown as C2S))).toBeNull(); // empty chat
    expect(decodeS2C(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("collision + move validation", () => {
  // 4x3 map, tile 16; one solid cell at (2,1).
  const map: TmjMap = {
    width: 4,
    height: 3,
    tilewidth: 16,
    layers: [
      { name: "ground", data: new Array(12).fill(1) },
      { name: "collision", data: [0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0] },
    ],
  };
  const grid = parseCollision(map);

  it("marks solid + open tiles", () => {
    expect(grid.solidTile(2, 1)).toBe(true);
    expect(grid.solidTile(0, 0)).toBe(false);
    expect(grid.solidTile(99, 99)).toBe(true); // out of bounds = solid
  });

  it("accepts a short step, rejects a teleport (speed cap)", () => {
    expect(isMoveLegal(grid, 8, 8, 14, 8, 20, 0)).toBe(true);
    expect(isMoveLegal(grid, 8, 8, 900, 8, 20, 0)).toBe(false);
  });

  it("rejects stepping into a wall", () => {
    // tile (2,1) center ~ (40, 24); feetDy 0 to test the point directly
    expect(isMoveLegal(grid, 40, 8, 40, 24, 999, 0)).toBe(false);
  });
});

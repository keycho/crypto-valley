import { describe, expect, it } from "vitest";

import { DB_PACKAGE } from "./index";

describe("db placeholder", () => {
  it("loads without needing a database connection", () => {
    expect(DB_PACKAGE).toBe("@crypto-valley/db");
  });
});

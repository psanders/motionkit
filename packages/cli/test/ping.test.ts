/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 */
import { expect } from "chai";
import { getPingPayload } from "../src/lib/ping.js";

describe("getPingPayload", () => {
  it("should return a static ok health payload", () => {
    // Act
    const result = getPingPayload();

    // Assert
    expect(result).to.deep.equal({ ok: true, version: "0.1.0" });
  });
});

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 */
import { expect } from "chai";
import { ping } from "../src/tools/ping.js";

describe("ping", () => {
  it("should return a static ok health payload", () => {
    // Act
    const result = ping();

    // Assert
    expect(result).to.deep.equal({ ok: true, version: "0.1.0" });
  });
});

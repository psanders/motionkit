/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 */
import { expect } from "chai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateVideo } from "../src/tools/validateVideo.js";
import { generateFixtureVideo } from "./support/generateFixture.js";

describe("validateVideo", () => {
  let specDir: string;

  beforeEach(() => {
    specDir = fs.mkdtempSync(path.join(os.tmpdir(), "motionkit-mcp-validate-"));
    generateFixtureVideo(path.join(specDir, "clip.mp4"));
  });

  afterEach(() => {
    fs.rmSync(specDir, { recursive: true, force: true });
  });

  it("should report a valid specification as valid", async () => {
    // Arrange
    const spec = {
      version: "1",
      format: "16:9",
      fps: 30,
      scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 1 }]
    };

    // Act
    const result = await validateVideo({ spec, specDir });

    // Assert
    expect(result.valid).to.equal(true);
  });

  it("should report every violation for an invalid specification, not just the first", async () => {
    // Arrange — a missing asset and a non-positive duration, both at once
    const spec = {
      version: "1",
      format: "16:9",
      fps: 30,
      scenes: [{ type: "a_roll", asset: "missing.mp4", duration: 0 }]
    };

    // Act
    const result = await validateVideo({ spec, specDir });

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const codes = result.errors.map((e) => e.code);
      expect(codes).to.include("ASSET_NOT_FOUND");
      expect(codes).to.include("INVALID_DURATION");
    }
  });

  it("should throw when specDir cannot be resolved", async () => {
    // Arrange
    const spec = {
      version: "1",
      format: "16:9",
      fps: 30,
      scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 1 }]
    };
    const missingDir = path.join(specDir, "does-not-exist");

    // Act + Assert
    try {
      await validateVideo({ spec, specDir: missingDir });
      expect.fail("expected validateVideo() to throw");
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
    }
  });
});

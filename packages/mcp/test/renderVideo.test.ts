/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Exercises the real `@motionkit/core` render pipeline through `renderVideo`
 * — a short, low-resolution fixture clip keeps this fast without mocking
 * Remotion (same approach `packages/cli/test/render.test.ts` takes).
 */
import { expect } from "chai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderVideo } from "../src/tools/renderVideo.js";
import { generateFixtureVideo } from "./support/generateFixture.js";

describe("renderVideo", function () {
  this.timeout(120_000);

  let specDir: string;
  let validSpec: unknown;

  beforeEach(() => {
    specDir = fs.mkdtempSync(path.join(os.tmpdir(), "motionkit-mcp-render-"));
    generateFixtureVideo(path.join(specDir, "clip.mp4"));
    validSpec = {
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 1 }]
    };
  });

  afterEach(() => {
    fs.rmSync(specDir, { recursive: true, force: true });
  });

  it("should render a valid specification and return its output path", async () => {
    // Arrange
    const outputPath = path.join(specDir, "custom.mp4");

    // Act
    const result = await renderVideo({ spec: validSpec, specDir, outputPath });

    // Assert
    expect(result).to.deep.equal({ outputPath });
    expect(fs.existsSync(outputPath)).to.equal(true);
  });

  it("should default the output path to <specDir>/output.mp4 when omitted", async () => {
    // Act
    const result = await renderVideo({ spec: validSpec, specDir });

    // Assert
    const expectedOutputPath = path.join(specDir, "output.mp4");
    expect(result).to.deep.equal({ outputPath: expectedOutputPath });
    expect(fs.existsSync(expectedOutputPath)).to.equal(true);
  });

  it("should refuse to render an invalid specification, report structured errors, and write no file", async () => {
    // Arrange
    const invalidSpec = {
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "does-not-exist.mp4", duration: 1 }]
    };
    const outputPath = path.join(specDir, "should-not-exist.mp4");

    // Act
    const result = await renderVideo({ spec: invalidSpec, specDir, outputPath });

    // Assert
    expect(result).to.have.property("valid", false);
    if ("valid" in result && !result.valid) {
      expect(result.errors.some((e) => e.code === "ASSET_NOT_FOUND")).to.equal(true);
    }
    expect(fs.existsSync(outputPath)).to.equal(false);
  });

  it("should throw when specDir cannot be resolved", async () => {
    // Arrange
    const missingDir = path.join(specDir, "does-not-exist");

    // Act + Assert
    try {
      await renderVideo({ spec: validSpec, specDir: missingDir });
      expect.fail("expected renderVideo() to throw");
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
    }
  });
});

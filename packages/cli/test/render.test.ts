/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Exercises the real `@motionkit/core` render pipeline through the CLI
 * command — a short, low-resolution fixture clip keeps this fast without
 * mocking Remotion.
 */
import { expect } from "chai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Render from "../src/commands/render.js";
import { generateFixtureVideo } from "./support/generateFixture.js";
import { runCliCommand } from "./support/runCliCommand.js";

describe("motionkit render", function () {
  this.timeout(120_000);

  let workDir: string;
  let specPath: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "motionkit-cli-render-"));
    generateFixtureVideo(path.join(workDir, "clip.mp4"));
    specPath = path.join(workDir, "spec.json");
    fs.writeFileSync(
      specPath,
      JSON.stringify({
        version: "1",
        format: "16:9",
        fps: 10,
        scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 1 }]
      })
    );
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it("should render a valid specification, print the output path, and exit 0", async () => {
    // Act
    const result = await runCliCommand(Render, [specPath]);

    // Assert
    const expectedOutput = path.join(workDir, "spec.mp4");
    expect(result.exitCode).to.equal(0);
    expect(result.output).to.include(expectedOutput);
    expect(fs.existsSync(expectedOutput)).to.equal(true);
  });

  it("should default the output path alongside the spec file when --output is omitted", async () => {
    // Act
    await runCliCommand(Render, [specPath]);

    // Assert
    expect(fs.existsSync(path.join(workDir, "spec.mp4"))).to.equal(true);
  });

  it("should honor an explicit --output path", async () => {
    // Arrange
    const explicitOutput = path.join(workDir, "custom", "video.mp4");

    // Act
    const result = await runCliCommand(Render, [specPath, "--output", explicitOutput]);

    // Assert
    expect(result.exitCode).to.equal(0);
    expect(result.output).to.include(explicitOutput);
    expect(fs.existsSync(explicitOutput)).to.equal(true);
    expect(fs.existsSync(path.join(workDir, "spec.mp4"))).to.equal(false);
  });

  it("should refuse to render an invalid specification, print structured errors, write no file, and exit non-zero", async () => {
    // Arrange
    const invalidSpecPath = path.join(workDir, "invalid.json");
    fs.writeFileSync(
      invalidSpecPath,
      JSON.stringify({
        version: "1",
        format: "16:9",
        fps: 10,
        scenes: [{ type: "a_roll", asset: "does-not-exist.mp4", duration: 1 }]
      })
    );

    // Act
    const result = await runCliCommand(Render, [invalidSpecPath]);

    // Assert
    expect(result.exitCode).to.not.equal(0);
    expect(result.output).to.include("ASSET_NOT_FOUND");
    expect(fs.existsSync(path.join(workDir, "invalid.mp4"))).to.equal(false);
  });
});

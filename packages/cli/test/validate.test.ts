/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 */
import { expect } from "chai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Validate from "../src/commands/validate.js";
import { generateFixtureVideo } from "./support/generateFixture.js";
import { runCliCommand } from "./support/runCliCommand.js";

describe("motionkit validate", () => {
  let workDir: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "motionkit-cli-validate-"));
    generateFixtureVideo(path.join(workDir, "clip.mp4"));
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it("should report success and exit 0 for a valid specification", async () => {
    // Arrange
    const specPath = path.join(workDir, "spec.json");
    fs.writeFileSync(
      specPath,
      JSON.stringify({
        version: "1",
        format: "16:9",
        fps: 30,
        scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 1 }]
      })
    );

    // Act
    const result = await runCliCommand(Validate, [specPath]);

    // Assert
    expect(result.exitCode).to.equal(0);
    expect(result.output).to.include("Valid Video Specification");
  });

  it("should print structured errors and exit non-zero for an invalid specification", async () => {
    // Arrange — references an asset that doesn't exist
    const specPath = path.join(workDir, "spec.json");
    fs.writeFileSync(
      specPath,
      JSON.stringify({
        version: "1",
        format: "16:9",
        fps: 30,
        scenes: [{ type: "a_roll", asset: "missing.mp4", duration: 1 }]
      })
    );

    // Act
    const result = await runCliCommand(Validate, [specPath]);

    // Assert
    expect(result.exitCode).to.not.equal(0);
    expect(result.output).to.include("ASSET_NOT_FOUND");
  });
});

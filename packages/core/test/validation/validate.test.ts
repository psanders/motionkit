/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 */
import { expect } from "chai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validate } from "../../src/validation/validate.js";
import type { VideoSpec } from "../../src/video-spec/types.js";

function validSpec(overrides: Partial<VideoSpec> = {}): VideoSpec {
  return {
    version: "1",
    format: "16:9",
    fps: 30,
    scenes: [{ type: "a_roll", asset: "a.mp4", duration: 5 }],
    ...overrides
  } as VideoSpec;
}

describe("validate", () => {
  let specDir: string;

  beforeEach(() => {
    specDir = fs.mkdtempSync(path.join(os.tmpdir(), "motionkit-validate-"));
    fs.writeFileSync(path.join(specDir, "a.mp4"), "");
    fs.writeFileSync(path.join(specDir, "b.mp4"), "");
  });

  afterEach(() => {
    fs.rmSync(specDir, { recursive: true, force: true });
  });

  it("should fail structural validation on a malformed document, without semantic checks", () => {
    // Arrange
    const doc = { version: "1", fps: 30, scenes: [] };

    // Act
    const result = validate(doc, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      expect(result.errors.length).to.be.greaterThan(0);
      expect(result.errors.every((e) => e.code === "MALFORMED_SPEC")).to.equal(true);
    }
  });

  it("should report a missing asset", () => {
    // Arrange
    const spec = validSpec({ scenes: [{ type: "a_roll", asset: "missing.mp4", duration: 5 }] });

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const error = result.errors.find((e) => e.code === "ASSET_NOT_FOUND");
      expect(error).to.not.equal(undefined);
      expect(error?.path).to.equal("scenes.0.asset");
    }
  });

  it("should suggest sibling files when an asset is missing", () => {
    // Arrange
    const spec = validSpec({ scenes: [{ type: "a_roll", asset: "missing.mp4", duration: 5 }] });

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const error = result.errors.find((e) => e.code === "ASSET_NOT_FOUND");
      expect(error?.suggestions).to.include.members(["a.mp4", "b.mp4"]);
    }
  });

  it("should reject a zero or negative duration", () => {
    // Arrange
    const spec = validSpec({ scenes: [{ type: "a_roll", asset: "a.mp4", duration: 0 }] });

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const error = result.errors.find((e) => e.code === "INVALID_DURATION");
      expect(error).to.not.equal(undefined);
      expect(error?.path).to.equal("scenes.0.duration");
    }
  });

  it("should reject an unsupported format, listing the supported formats", () => {
    // Arrange
    const spec = { ...validSpec(), format: "1:1" };

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const error = result.errors.find((e) => e.code === "UNSUPPORTED_FORMAT");
      expect(error).to.not.equal(undefined);
      expect(error?.message).to.include("16:9");
      expect(error?.message).to.include("9:16");
    }
  });

  it("should reject an unsupported transition, listing the supported transitions", () => {
    // Arrange
    const spec = validSpec({
      scenes: [
        { type: "a_roll", asset: "a.mp4", duration: 5 },
        { type: "b_roll", asset: "b.mp4", duration: 3, transition: { type: "wipe" } }
      ]
    } as unknown as Partial<VideoSpec>);

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const error = result.errors.find((e) => e.code === "UNSUPPORTED_TRANSITION");
      expect(error).to.not.equal(undefined);
      expect(error?.message).to.include("fade");
    }
  });

  it("should report multiple simultaneous violations in a single result", () => {
    // Arrange — a missing asset and a negative duration, together
    const spec = validSpec({ scenes: [{ type: "a_roll", asset: "missing.mp4", duration: -2 }] });

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const codes = result.errors.map((e) => e.code).sort();
      expect(codes).to.deep.equal(["ASSET_NOT_FOUND", "INVALID_DURATION"]);
    }
  });

  it("should never throw for malformed input", () => {
    // Act + Assert
    expect(() => validate({ garbage: true }, specDir)).to.not.throw();
    expect(() => validate(null, specDir)).to.not.throw();
    expect(() => validate(undefined, specDir)).to.not.throw();
  });

  it("should pass a fully valid specification with no reported errors", () => {
    // Arrange
    const spec = validSpec();

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(true);
    expect((result as { errors?: unknown }).errors).to.equal(undefined);
  });
});

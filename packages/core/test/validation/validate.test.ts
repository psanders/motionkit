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
    const spec = { ...validSpec(), format: "4:3" };

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const error = result.errors.find((e) => e.code === "UNSUPPORTED_FORMAT");
      expect(error).to.not.equal(undefined);
      expect(error?.message).to.include("16:9");
      expect(error?.message).to.include("9:16");
      expect(error?.message).to.include("1:1");
    }
  });

  it("should accept the 1:1 format", () => {
    // Arrange
    const spec = { ...validSpec(), format: "1:1" };

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(true);
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

  it("should accept the built-in 'default' brand implicitly when brand is omitted", () => {
    // Arrange
    const spec = validSpec();

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(true);
  });

  it("should report an unknown brand id", () => {
    // Arrange
    const spec = validSpec({ brand: "does-not-exist" });

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const error = result.errors.find((e) => e.code === "BRAND_NOT_FOUND");
      expect(error).to.not.equal(undefined);
      expect(error?.message).to.include("does-not-exist");
    }
  });

  it("should suggest available brands when the brand id is unknown", () => {
    // Arrange
    const spec = validSpec({ brand: "does-not-exist" });

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const error = result.errors.find((e) => e.code === "BRAND_NOT_FOUND");
      expect(error?.suggestions).to.include("default");
    }
  });

  it("should reject an empty caption", () => {
    // Arrange
    const spec = validSpec({
      scenes: [{ type: "a_roll", asset: "a.mp4", duration: 5, caption: "" }]
    } as unknown as Partial<VideoSpec>);

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const error = result.errors.find((e) => e.code === "EMPTY_CAPTION");
      expect(error).to.not.equal(undefined);
      expect(error?.path).to.equal("scenes.0.caption");
    }
  });

  it("should accept a non-empty caption", () => {
    // Arrange
    const spec = validSpec({
      scenes: [{ type: "a_roll", asset: "a.mp4", duration: 5, caption: "Hello" }]
    } as unknown as Partial<VideoSpec>);

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(true);
  });

  it("should reject an unsupported frame value, listing the supported frame types", () => {
    // Arrange
    const spec = {
      ...validSpec(),
      scenes: [{ type: "a_roll", asset: "a.mp4", duration: 5, frame: "polaroid" }]
    };

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const error = result.errors.find((e) => e.code === "UNSUPPORTED_FRAME");
      expect(error).to.not.equal(undefined);
      expect(error?.message).to.include("browser");
    }
  });

  it("should accept a supported frame value", () => {
    // Arrange
    const spec = {
      ...validSpec(),
      scenes: [{ type: "a_roll", asset: "a.mp4", duration: 5, frame: "browser" }]
    };

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(true);
  });

  it("should reject an unsupported logo position, listing the supported placements", () => {
    // Arrange
    const spec = {
      ...validSpec(),
      scenes: [{ type: "a_roll", asset: "a.mp4", duration: 5, logo: { position: "middle" } }]
    };

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const error = result.errors.find((e) => e.code === "UNSUPPORTED_LOGO_POSITION");
      expect(error).to.not.equal(undefined);
      expect(error?.message).to.include("top_left");
    }
  });

  it("should accept a logo overlay with the default placement and with an override", () => {
    // Arrange
    const spec = {
      ...validSpec(),
      scenes: [
        { type: "a_roll", asset: "a.mp4", duration: 5, logo: true },
        { type: "b_roll", asset: "b.mp4", duration: 3, logo: { position: "top_left" } }
      ]
    };

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(true);
  });

  for (const type of ["fade", "slide-left", "slide-right", "zoom"] as const) {
    it(`should accept the expanded transition type '${type}'`, () => {
      // Arrange
      const spec = {
        ...validSpec(),
        scenes: [
          { type: "a_roll", asset: "a.mp4", duration: 5 },
          { type: "b_roll", asset: "b.mp4", duration: 3, transition: { type } }
        ]
      };

      // Act
      const result = validate(spec, specDir);

      // Assert
      expect(result.valid).to.equal(true);
    });
  }

  it("should reject an unsupported transition, listing the full expanded set", () => {
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
      expect(error?.message).to.include("slide-left");
      expect(error?.message).to.include("slide-right");
      expect(error?.message).to.include("zoom");
    }
  });

  it("should report an unknown brand together with a semantic asset/duration violation in a single result", () => {
    // Arrange
    const spec = validSpec({
      brand: "does-not-exist",
      scenes: [{ type: "a_roll", asset: "missing.mp4", duration: -1 }]
    });

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const codes = result.errors.map((e) => e.code).sort();
      expect(codes).to.deep.equal(["ASSET_NOT_FOUND", "BRAND_NOT_FOUND", "INVALID_DURATION"]);
    }
  });

  it("should report an empty caption together with another semantic violation in a single result", () => {
    // Arrange
    const spec = validSpec({
      scenes: [{ type: "a_roll", asset: "missing.mp4", duration: 5, caption: "" }]
    } as unknown as Partial<VideoSpec>);

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const codes = result.errors.map((e) => e.code).sort();
      expect(codes).to.deep.equal(["ASSET_NOT_FOUND", "EMPTY_CAPTION"]);
    }
  });

  it("should accept a phone frame", () => {
    // Arrange
    const spec = validSpec({
      scenes: [{ type: "a_roll", asset: "a.mp4", duration: 5, frame: "phone" }]
    } as unknown as Partial<VideoSpec>);

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(true);
  });

  it("should reject an unsupported motion type, listing the supported motion types", () => {
    // Arrange
    const spec = validSpec({
      scenes: [{ type: "a_roll", asset: "a.mp4", duration: 5, motion: { type: "spin" } }]
    } as unknown as Partial<VideoSpec>);

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const error = result.errors.find((e) => e.code === "UNSUPPORTED_MOTION_TYPE");
      expect(error).to.not.equal(undefined);
      expect(error?.message).to.include("horizontal_pan");
      expect(error?.message).to.include("zoom");
    }
  });

  it("should reject a direction mismatched with its motion type", () => {
    // Arrange
    const spec = validSpec({
      scenes: [
        {
          type: "a_roll",
          asset: "a.mp4",
          duration: 5,
          motion: { type: "zoom", direction: "left_to_right" }
        }
      ]
    } as unknown as Partial<VideoSpec>);

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const error = result.errors.find((e) => e.code === "MOTION_DIRECTION_MISMATCH");
      expect(error).to.not.equal(undefined);
    }
  });

  it("should reject an out-of-bounds focal point", () => {
    // Arrange
    const spec = validSpec({
      scenes: [
        {
          type: "a_roll",
          asset: "a.mp4",
          duration: 5,
          motion: { type: "static", focalPoint: { x: 1.5, y: 0.5 } }
        }
      ]
    } as unknown as Partial<VideoSpec>);

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(false);
    if (!result.valid) {
      const error = result.errors.find((e) => e.code === "FOCAL_POINT_OUT_OF_BOUNDS");
      expect(error).to.not.equal(undefined);
      expect(error?.path).to.equal("scenes.0.motion.focalPoint.x");
    }
  });

  it("should accept an in-bounds focal point", () => {
    // Arrange
    const spec = validSpec({
      scenes: [
        {
          type: "a_roll",
          asset: "a.mp4",
          duration: 5,
          motion: { type: "static", focalPoint: { x: 0, y: 1 } }
        }
      ]
    } as unknown as Partial<VideoSpec>);

    // Act
    const result = validate(spec, specDir);

    // Assert
    expect(result.valid).to.equal(true);
  });
});

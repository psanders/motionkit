/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 */
import { expect } from "chai";
import { videoSpecSchema } from "../../src/video-spec/schema.js";
import type { VideoSpec } from "../../src/video-spec/types.js";

function baseSpec(overrides: Partial<VideoSpec> = {}): unknown {
  return {
    version: "1",
    format: "16:9",
    fps: 30,
    scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 5 }],
    ...overrides
  };
}

describe("videoSpecSchema", () => {
  it("should accept a well-formed document", () => {
    // Act
    const result = videoSpecSchema.safeParse(baseSpec());

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should reject a document missing format", () => {
    // Arrange
    const doc = baseSpec() as Record<string, unknown>;
    delete doc.format;

    // Act
    const result = videoSpecSchema.safeParse(doc);

    // Assert
    expect(result.success).to.equal(false);
  });

  it("should reject a document missing fps", () => {
    // Arrange
    const doc = baseSpec() as Record<string, unknown>;
    delete doc.fps;

    // Act
    const result = videoSpecSchema.safeParse(doc);

    // Assert
    expect(result.success).to.equal(false);
  });

  it("should reject a document missing scenes", () => {
    // Arrange
    const doc = baseSpec() as Record<string, unknown>;
    delete doc.scenes;

    // Act
    const result = videoSpecSchema.safeParse(doc);

    // Assert
    expect(result.success).to.equal(false);
  });

  it("should accept an a_roll scene", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({ scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 5 }] })
    );

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should accept a b_roll scene", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          { type: "a_roll", asset: "a.mp4", duration: 5 },
          { type: "b_roll", asset: "b.mp4", duration: 3 }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should reject an unknown scene type", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({ scenes: [{ type: "c_roll", asset: "clip.mp4", duration: 5 }] })
    );

    // Assert
    expect(result.success).to.equal(false);
  });

  it("should default a b_roll scene's audio to 'continue'", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          { type: "a_roll", asset: "a.mp4", duration: 5 },
          { type: "b_roll", asset: "b.mp4", duration: 3 }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success && result.data.scenes[1]?.type === "b_roll") {
      expect(result.data.scenes[1].audio).to.equal("continue");
    }
  });

  it("should accept a b_roll scene with an explicit muted audio", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          { type: "a_roll", asset: "a.mp4", duration: 5 },
          { type: "b_roll", asset: "b.mp4", duration: 3, audio: "muted" }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success && result.data.scenes[1]?.type === "b_roll") {
      expect(result.data.scenes[1].audio).to.equal("muted");
    }
  });

  it("should accept a fade transition on a non-first scene", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          { type: "a_roll", asset: "a.mp4", duration: 5 },
          { type: "b_roll", asset: "b.mp4", duration: 3, transition: { type: "fade" } }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should reject an unsupported transition type", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          { type: "a_roll", asset: "a.mp4", duration: 5 },
          { type: "b_roll", asset: "b.mp4", duration: 3, transition: { type: "wipe" } }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(false);
  });

  it("should reject a transition declared on the first scene", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [{ type: "a_roll", asset: "a.mp4", duration: 5, transition: { type: "fade" } }]
      })
    );

    // Assert
    expect(result.success).to.equal(false);
  });

  it("should accept the 16:9 format", () => {
    // Act
    const result = videoSpecSchema.safeParse(baseSpec({ format: "16:9" }));

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should accept the 9:16 format", () => {
    // Act
    const result = videoSpecSchema.safeParse(baseSpec({ format: "9:16" }));

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should reject an unsupported format", () => {
    // Act
    const result = videoSpecSchema.safeParse(baseSpec({ format: "1:1" }));

    // Assert
    expect(result.success).to.equal(false);
  });

  it("should accept an explicit brand id", () => {
    // Act
    const result = videoSpecSchema.safeParse(baseSpec({ brand: "acme" }));

    // Assert
    expect(result.success).to.equal(true);
    if (result.success) {
      expect(result.data.brand).to.equal("acme");
    }
  });

  it("should default an omitted brand to 'default'", () => {
    // Act
    const result = videoSpecSchema.safeParse(baseSpec());

    // Assert
    expect(result.success).to.equal(true);
    if (result.success) {
      expect(result.data.brand).to.equal("default");
    }
  });

  it("should accept a scene caption", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({ scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 5, caption: "Hello" }] })
    );

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should accept a scene with no caption", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({ scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 5 }] })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success) {
      expect(result.data.scenes[0]?.caption).to.equal(undefined);
    }
  });

  it("should accept a browser frame", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 5, frame: "browser" }]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should reject an unrecognized frame value", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 5, frame: "polaroid" }]
      })
    );

    // Assert
    expect(result.success).to.equal(false);
  });

  it("should accept a logo overlay with the brand's default placement", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({ scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 5, logo: true }] })
    );

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should accept a logo overlay with an overridden placement", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          {
            type: "a_roll",
            asset: "clip.mp4",
            duration: 5,
            logo: { position: "top_left" }
          }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success) {
      const scene = result.data.scenes[0];
      expect(scene?.logo).to.deep.equal({ position: "top_left" });
    }
  });

  it("should reject a logo overlay with an unsupported placement", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 5, logo: { position: "middle" } }]
      })
    );

    // Assert
    expect(result.success).to.equal(false);
  });

  for (const type of ["fade", "slide-left", "slide-right", "zoom"] as const) {
    it(`should accept the '${type}' transition on a non-first scene`, () => {
      // Act
      const result = videoSpecSchema.safeParse(
        baseSpec({
          scenes: [
            { type: "a_roll", asset: "a.mp4", duration: 5 },
            { type: "b_roll", asset: "b.mp4", duration: 3, transition: { type } }
          ]
        })
      );

      // Assert
      expect(result.success).to.equal(true);
    });
  }

  it("should still reject an unrecognized transition type", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          { type: "a_roll", asset: "a.mp4", duration: 5 },
          { type: "b_roll", asset: "b.mp4", duration: 3, transition: { type: "wipe" } }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(false);
  });

  it("should accept a transition without an explicit duration", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          { type: "a_roll", asset: "a.mp4", duration: 5 },
          { type: "b_roll", asset: "b.mp4", duration: 3, transition: { type: "fade" } }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success && result.data.scenes[1]?.transition) {
      expect(result.data.scenes[1].transition.duration).to.equal(undefined);
    }
  });

  it("should accept a transition with an explicit duration", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          { type: "a_roll", asset: "a.mp4", duration: 5 },
          {
            type: "b_roll",
            asset: "b.mp4",
            duration: 3,
            transition: { type: "fade", duration: 1.2 }
          }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success && result.data.scenes[1]?.transition) {
      expect(result.data.scenes[1].transition.duration).to.equal(1.2);
    }
  });
});

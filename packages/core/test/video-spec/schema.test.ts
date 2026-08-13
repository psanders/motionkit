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

  it("should accept the 1:1 format", () => {
    // Act
    const result = videoSpecSchema.safeParse(baseSpec({ format: "1:1" }));

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should reject an unsupported format", () => {
    // Act
    const result = videoSpecSchema.safeParse(baseSpec({ format: "4:3" }));

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

  it("should accept a phone frame", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 5, frame: "phone" }]
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

  it("should accept a horizontal_pan motion, defaulting direction to left_to_right", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          { type: "a_roll", asset: "clip.mp4", duration: 5, motion: { type: "horizontal_pan" } }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success) {
      const motion = result.data.scenes[0]?.motion;
      expect(motion?.type).to.equal("horizontal_pan");
      if (motion?.type === "horizontal_pan") {
        expect(motion.direction).to.equal("left_to_right");
      }
    }
  });

  it("should accept a horizontal_pan motion with an overridden direction", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          {
            type: "a_roll",
            asset: "clip.mp4",
            duration: 5,
            motion: { type: "horizontal_pan", direction: "right_to_left" }
          }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should accept a vertical_pan motion, defaulting direction to top_to_bottom", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          { type: "a_roll", asset: "clip.mp4", duration: 5, motion: { type: "vertical_pan" } }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success) {
      const motion = result.data.scenes[0]?.motion;
      expect(motion?.type).to.equal("vertical_pan");
      if (motion?.type === "vertical_pan") {
        expect(motion.direction).to.equal("top_to_bottom");
      }
    }
  });

  it("should accept a vertical_pan motion with an overridden direction", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          {
            type: "a_roll",
            asset: "clip.mp4",
            duration: 5,
            motion: { type: "vertical_pan", direction: "bottom_to_top" }
          }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should accept a zoom motion", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 5, motion: { type: "zoom" } }]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should accept a static motion with a focal point", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          {
            type: "a_roll",
            asset: "clip.mp4",
            duration: 5,
            motion: { type: "static", focalPoint: { x: 0.5, y: 0.3 } }
          }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should accept a motion with no focal point", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 5, motion: { type: "zoom" } }]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should reject an unrecognized motion type", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 5, motion: { type: "spin" } }]
      })
    );

    // Assert
    expect(result.success).to.equal(false);
  });

  it("should reject a direction on a zoom motion", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          {
            type: "a_roll",
            asset: "clip.mp4",
            duration: 5,
            motion: { type: "zoom", direction: "left_to_right" }
          }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(false);
  });

  it("should reject a direction on a static motion", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          {
            type: "a_roll",
            asset: "clip.mp4",
            duration: 5,
            motion: { type: "static", direction: "top_to_bottom" }
          }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(false);
  });

  it("should accept a scene with motion but no frame", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        scenes: [
          { type: "b_roll", asset: "clip.mp4", duration: 5, motion: { type: "horizontal_pan" } }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success) {
      expect(result.data.scenes[0]?.frame).to.equal(undefined);
    }
  });

  it("should accept a scene with no motion at all", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({ scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 5 }] })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success) {
      expect(result.data.scenes[0]?.motion).to.equal(undefined);
    }
  });

  it("should accept a well-formed PIP overlay", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        overlays: [{ type: "pip", sceneIndex: 0, asset: "webcam.mp4", audio: "own" }]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
  });

  it("should accept a document with no overlays", () => {
    // Act
    const result = videoSpecSchema.safeParse(baseSpec());

    // Assert
    expect(result.success).to.equal(true);
    if (result.success) {
      expect(result.data.overlays).to.equal(undefined);
    }
  });

  it("should reject a PIP overlay missing audio", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        overlays: [{ type: "pip", sceneIndex: 0, asset: "webcam.mp4" }]
      })
    );

    // Assert
    expect(result.success).to.equal(false);
  });

  it("should default a PIP overlay's position to undefined (deferred to the brand at render time)", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        overlays: [{ type: "pip", sceneIndex: 0, asset: "webcam.mp4", audio: "muted" }]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success && result.data.overlays?.[0]?.type === "pip") {
      expect(result.data.overlays[0].position).to.equal(undefined);
    }
  });

  it("should accept a PIP overlay with an explicit position", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        overlays: [
          { type: "pip", sceneIndex: 0, asset: "webcam.mp4", audio: "muted", position: "top_left" }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success && result.data.overlays?.[0]?.type === "pip") {
      expect(result.data.overlays[0].position).to.equal("top_left");
    }
  });

  it("should default a PIP overlay's shape to circle", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        overlays: [{ type: "pip", sceneIndex: 0, asset: "webcam.mp4", audio: "muted" }]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success && result.data.overlays?.[0]?.type === "pip") {
      expect(result.data.overlays[0].shape).to.equal("circle");
    }
  });

  it("should accept a PIP overlay with shape: rounded_square", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        overlays: [
          {
            type: "pip",
            sceneIndex: 0,
            asset: "webcam.mp4",
            audio: "muted",
            shape: "rounded_square"
          }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success && result.data.overlays?.[0]?.type === "pip") {
      expect(result.data.overlays[0].shape).to.equal("rounded_square");
    }
  });

  it("should default a PIP overlay's size to md", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        overlays: [{ type: "pip", sceneIndex: 0, asset: "webcam.mp4", audio: "muted" }]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success && result.data.overlays?.[0]?.type === "pip") {
      expect(result.data.overlays[0].size).to.equal("md");
    }
  });

  it("should accept a PIP overlay with an overridden size", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        overlays: [{ type: "pip", sceneIndex: 0, asset: "webcam.mp4", audio: "muted", size: "lg" }]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success && result.data.overlays?.[0]?.type === "pip") {
      expect(result.data.overlays[0].size).to.equal("lg");
    }
  });

  it("should accept multiple PIP overlays targeting the same sceneIndex", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        overlays: [
          { type: "pip", sceneIndex: 0, asset: "webcam-1.mp4", audio: "own" },
          { type: "pip", sceneIndex: 0, asset: "webcam-2.mp4", audio: "muted" }
        ]
      })
    );

    // Assert
    expect(result.success).to.equal(true);
    if (result.success) {
      expect(result.data.overlays?.length).to.equal(2);
    }
  });

  it("should reject an unrecognized overlay type", () => {
    // Act
    const result = videoSpecSchema.safeParse(
      baseSpec({
        overlays: [{ type: "music", sceneIndex: 0, asset: "bed.mp3" }]
      })
    );

    // Assert
    expect(result.success).to.equal(false);
  });
});

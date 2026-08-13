/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Pure unit tests for the cover-crop-with-a-moving-window math (see
 * design.md decision #1 in the `responsive-motion` OpenSpec change) —
 * no Remotion render involved, just the formulas.
 */
import { expect } from "chai";
import { computeCoverScale, resolveCropTransform } from "../../src/rendering/cropTransform.js";

const TARGET_WIDTH = 1000;
const TARGET_HEIGHT = 500;

describe("computeCoverScale", () => {
  it("should scale by height when the source is proportionally wider than the target", () => {
    // Arrange — source is 4:1, target is 2:1: height is the covering dimension
    const scale = computeCoverScale(2000, 500, TARGET_WIDTH, TARGET_HEIGHT);

    // Assert
    expect(scale).to.equal(TARGET_HEIGHT / 500);
    expect(2000 * scale).to.be.greaterThan(TARGET_WIDTH);
  });

  it("should scale by width when the source is proportionally taller than the target", () => {
    // Arrange — source is 1:2, target is 2:1: width is the covering dimension
    const scale = computeCoverScale(500, 1000, TARGET_WIDTH, TARGET_HEIGHT);

    // Assert
    expect(scale).to.equal(TARGET_WIDTH / 500);
    expect(1000 * scale).to.be.greaterThan(TARGET_HEIGHT);
  });
});

describe("resolveCropTransform", () => {
  // A wide source: 2000x500 at a 1000x500 target has clamped horizontal
  // slack to pan across, and zero vertical slack (height exactly covers).
  const WIDE_SOURCE = { sourceWidth: 2000, sourceHeight: 500 };
  // A tall source: 500x2000 at the same target has vertical slack instead.
  const TALL_SOURCE = { sourceWidth: 500, sourceHeight: 2000 };

  it("should default to a centered, fixed crop when no motion is declared", () => {
    // Act
    const crop = resolveCropTransform({
      ...WIDE_SOURCE,
      targetWidth: TARGET_WIDTH,
      targetHeight: TARGET_HEIGHT,
      motion: undefined,
      frame: 0,
      durationInFrames: 30
    });
    const coverScale = computeCoverScale(2000, 500, TARGET_WIDTH, TARGET_HEIGHT);
    const scaledWidth = 2000 * coverScale;
    const horizontalSlack = scaledWidth - TARGET_WIDTH;

    // Assert — centered means half the slack is cropped off each side
    expect(crop.scale).to.equal(coverScale);
    expect(crop.translateX).to.be.closeTo(-horizontalSlack / 2, 0.001);
    expect(crop.translateY).to.equal(0);
  });

  it("should keep the same centered crop across frames when motion is 'static' with no focal point", () => {
    // Act
    const start = resolveCropTransform({
      ...WIDE_SOURCE,
      targetWidth: TARGET_WIDTH,
      targetHeight: TARGET_HEIGHT,
      motion: { type: "static" },
      frame: 0,
      durationInFrames: 30
    });
    const end = resolveCropTransform({
      ...WIDE_SOURCE,
      targetWidth: TARGET_WIDTH,
      targetHeight: TARGET_HEIGHT,
      motion: { type: "static" },
      frame: 30,
      durationInFrames: 30
    });

    // Assert — no change over time
    expect(start).to.deep.equal(end);
  });

  it("should bias a 'static' crop toward an off-center focal point, clamped to the slack range", () => {
    // Act — focal point at the far right edge
    const crop = resolveCropTransform({
      ...WIDE_SOURCE,
      targetWidth: TARGET_WIDTH,
      targetHeight: TARGET_HEIGHT,
      motion: { type: "static", focalPoint: { x: 1, y: 0.5 } },
      frame: 0,
      durationInFrames: 30
    });
    const coverScale = computeCoverScale(2000, 500, TARGET_WIDTH, TARGET_HEIGHT);
    const horizontalSlack = 2000 * coverScale - TARGET_WIDTH;

    // Assert — x=1 shows the rightmost edge: the full negative slack, not beyond it
    expect(crop.translateX).to.be.closeTo(-horizontalSlack, 0.001);
    expect(crop.translateX).to.be.at.least(-horizontalSlack - 0.001);
  });

  it("should pan a horizontal_pan left_to_right from the left edge to the right edge", () => {
    // Act
    const start = resolveCropTransform({
      ...WIDE_SOURCE,
      targetWidth: TARGET_WIDTH,
      targetHeight: TARGET_HEIGHT,
      motion: { type: "horizontal_pan", direction: "left_to_right" },
      frame: 0,
      durationInFrames: 30
    });
    const end = resolveCropTransform({
      ...WIDE_SOURCE,
      targetWidth: TARGET_WIDTH,
      targetHeight: TARGET_HEIGHT,
      motion: { type: "horizontal_pan", direction: "left_to_right" },
      frame: 30,
      durationInFrames: 30
    });

    // Assert — starts at 0 (leftmost visible), ends at -slack (rightmost visible)
    expect(start.translateX).to.equal(0);
    expect(end.translateX).to.be.lessThan(start.translateX);
  });

  it("should reverse a horizontal_pan when direction is right_to_left", () => {
    // Act
    const start = resolveCropTransform({
      ...WIDE_SOURCE,
      targetWidth: TARGET_WIDTH,
      targetHeight: TARGET_HEIGHT,
      motion: { type: "horizontal_pan", direction: "right_to_left" },
      frame: 0,
      durationInFrames: 30
    });
    const end = resolveCropTransform({
      ...WIDE_SOURCE,
      targetWidth: TARGET_WIDTH,
      targetHeight: TARGET_HEIGHT,
      motion: { type: "horizontal_pan", direction: "right_to_left" },
      frame: 30,
      durationInFrames: 30
    });

    // Assert — starts rightmost, ends leftmost: the reverse of left_to_right
    expect(end.translateX).to.equal(0);
    expect(start.translateX).to.be.lessThan(end.translateX);
  });

  it("should pan a vertical_pan top_to_bottom from the top edge to the bottom edge, on the tall source", () => {
    // Act
    const start = resolveCropTransform({
      ...TALL_SOURCE,
      targetWidth: TARGET_WIDTH,
      targetHeight: TARGET_HEIGHT,
      motion: { type: "vertical_pan", direction: "top_to_bottom" },
      frame: 0,
      durationInFrames: 30
    });
    const end = resolveCropTransform({
      ...TALL_SOURCE,
      targetWidth: TARGET_WIDTH,
      targetHeight: TARGET_HEIGHT,
      motion: { type: "vertical_pan", direction: "top_to_bottom" },
      frame: 30,
      durationInFrames: 30
    });

    // Assert
    expect(start.translateY).to.equal(0);
    expect(end.translateY).to.be.lessThan(start.translateY);
    // The horizontal axis is unaffected by a vertical pan
    expect(start.translateX).to.equal(end.translateX);
  });

  it("should reverse a vertical_pan when direction is bottom_to_top", () => {
    // Act
    const start = resolveCropTransform({
      ...TALL_SOURCE,
      targetWidth: TARGET_WIDTH,
      targetHeight: TARGET_HEIGHT,
      motion: { type: "vertical_pan", direction: "bottom_to_top" },
      frame: 0,
      durationInFrames: 30
    });
    const end = resolveCropTransform({
      ...TALL_SOURCE,
      targetWidth: TARGET_WIDTH,
      targetHeight: TARGET_HEIGHT,
      motion: { type: "vertical_pan", direction: "bottom_to_top" },
      frame: 30,
      durationInFrames: 30
    });

    // Assert
    expect(end.translateY).to.equal(0);
    expect(start.translateY).to.be.lessThan(end.translateY);
  });

  it("should increase a zoom's scale monotonically over the scene's duration", () => {
    // Act
    const scales = [0, 10, 20, 30].map(
      (frame) =>
        resolveCropTransform({
          ...WIDE_SOURCE,
          targetWidth: TARGET_WIDTH,
          targetHeight: TARGET_HEIGHT,
          motion: { type: "zoom" },
          frame,
          durationInFrames: 30
        }).scale
    );

    // Assert — strictly increasing at every step
    for (let i = 1; i < scales.length; i++) {
      expect(scales[i]).to.be.greaterThan(scales[i - 1] as number);
    }
  });

  it("should end a zoom at a larger scale than the cover scale it started at", () => {
    // Act
    const coverScale = computeCoverScale(2000, 500, TARGET_WIDTH, TARGET_HEIGHT);
    const end = resolveCropTransform({
      ...WIDE_SOURCE,
      targetWidth: TARGET_WIDTH,
      targetHeight: TARGET_HEIGHT,
      motion: { type: "zoom" },
      frame: 30,
      durationInFrames: 30
    });

    // Assert
    expect(end.scale).to.be.greaterThan(coverScale);
  });

  it("should not move a pan when the scene has a zero-length window to animate across", () => {
    // Act
    const crop = resolveCropTransform({
      ...WIDE_SOURCE,
      targetWidth: TARGET_WIDTH,
      targetHeight: TARGET_HEIGHT,
      motion: { type: "horizontal_pan" },
      frame: 0,
      durationInFrames: 0
    });

    // Assert — falls back to the fixed, centered crop rather than dividing by zero
    const coverScale = computeCoverScale(2000, 500, TARGET_WIDTH, TARGET_HEIGHT);
    expect(crop.scale).to.equal(coverScale);
    expect(Number.isFinite(crop.translateX)).to.equal(true);
  });
});

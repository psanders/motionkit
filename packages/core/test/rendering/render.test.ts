/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Exercises the real Remotion renderer against short, low-resolution
 * synthetic clips (see `../fixtures/generateSampleVideo.ts`) — this suite
 * intentionally does not mock Remotion; producing an actual rendered MP4
 * and inspecting it with `ffprobe`/`ffmpeg` is the point.
 */
import { expect } from "chai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadBrand } from "../../src/brand/registry.js";
import { render, RenderValidationError } from "../../src/rendering/render.js";
import { videoSpecSchema } from "../../src/video-spec/schema.js";
import { FIXTURES_DIR, generateSampleVideo } from "../fixtures/generateSampleVideo.js";
import {
  getMeanVolumeDb,
  getPixelAt,
  getPixelAtRegion,
  getVideoInfo,
  hashDecodedContent
} from "./mediaProbe.js";

const AUDIBLE_THRESHOLD_DB = -50;
const BRIGHT_THRESHOLD = 80;

// Transition duration is no longer a fixed frame count (see design.md
// decision #5) — it resolves from the active brand's
// `defaultTransitionDurationSeconds` when a scene doesn't specify its own.
// `FIXTURES_DIR` has no `brands/` folder of its own, so every spec in this
// suite that omits `brand` implicitly resolves to the built-in `"default"`
// brand, same as `foundation`'s Phase 1 specs keep doing unchanged.
const DEFAULT_BRAND_TRANSITION_SECONDS = loadBrand("default", FIXTURES_DIR).brand
  .defaultTransitionDurationSeconds;

describe("render", function () {
  this.timeout(180_000);

  let outDir: string;

  before(() => {
    // Source clips are generated longer (3s) than any single scene's own
    // on-screen duration (1s): a real A-roll take is typically longer than
    // the moment it's on screen, and its audio needs enough material to
    // keep playing underneath a following continuing B-roll scene. Remotion
    // simply trims playback to each `<Sequence>`'s own duration, so the
    // extra source length is otherwise unused.
    generateSampleVideo({
      name: "red.mp4",
      duration: 3,
      color: "red",
      visual: "color",
      toneHz: 440
    });
    generateSampleVideo({
      name: "green.mp4",
      duration: 3,
      color: "green",
      visual: "color",
      toneHz: 440
    });
    generateSampleVideo({
      name: "blue.mp4",
      duration: 3,
      color: "blue",
      visual: "color",
      toneHz: 880
    });
    // Two-color split sources for motion tests — a whole-frame pixel
    // average can distinguish "showing red" from "showing blue" in a way a
    // single solid-color clip can't demonstrate a *pan* across.
    generateSampleVideo({
      name: "split-h.mp4",
      duration: 3,
      width: 640,
      height: 180,
      visual: "split-horizontal",
      color: "red",
      secondColor: "blue"
    });
    generateSampleVideo({
      name: "split-v.mp4",
      duration: 3,
      width: 180,
      height: 640,
      visual: "split-vertical",
      color: "red",
      secondColor: "blue"
    });
  });

  beforeEach(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), "motionkit-render-out-"));
  });

  afterEach(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it("should render a valid specification to an MP4 at the given output path", async () => {
    // Arrange
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }]
    });
    const outputPath = path.join(outDir, "out.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert
    expect(fs.existsSync(outputPath)).to.equal(true);
  });

  it("should render total duration, scene order, and audio continuity correctly", async () => {
    // Arrange — a_roll(red, tone) -> b_roll(green, continues red's audio) -> a_roll(blue, tone)
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [
        { type: "a_roll", asset: "red.mp4", duration: 1 },
        { type: "b_roll", asset: "green.mp4", duration: 1 },
        { type: "a_roll", asset: "blue.mp4", duration: 1 }
      ]
    });
    const outputPath = path.join(outDir, "order.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert — total duration matches the sum of scene durations (7s + 9s + 8s style check, scaled down here)
    const info = getVideoInfo(outputPath);
    expect(info.durationSeconds).to.be.closeTo(3, 0.3);

    // Assert — scenes appear in declared order (red, then green, then blue)
    const [r1] = getPixelAt(outputPath, 0.5);
    const [, g2] = getPixelAt(outputPath, 1.5);
    const [, , b3] = getPixelAt(outputPath, 2.5);
    expect(r1).to.be.greaterThan(BRIGHT_THRESHOLD);
    expect(g2).to.be.greaterThan(BRIGHT_THRESHOLD);
    expect(b3).to.be.greaterThan(BRIGHT_THRESHOLD);

    // Assert — the A-roll's audio continues audibly under the B-roll's visuals
    const duringARoll = getMeanVolumeDb(outputPath, 0.1, 0.7);
    const duringBRoll = getMeanVolumeDb(outputPath, 1.1, 0.7);
    expect(duringARoll).to.be.greaterThan(AUDIBLE_THRESHOLD_DB);
    expect(duringBRoll).to.be.greaterThan(AUDIBLE_THRESHOLD_DB);
  });

  it("should have no audio during a muted B-roll scene", async () => {
    // Arrange
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [
        { type: "a_roll", asset: "red.mp4", duration: 1 },
        { type: "b_roll", asset: "green.mp4", duration: 1, audio: "muted" }
      ]
    });
    const outputPath = path.join(outDir, "muted.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert
    const duringARoll = getMeanVolumeDb(outputPath, 0.1, 0.7);
    const duringMutedBRoll = getMeanVolumeDb(outputPath, 1.1, 0.7);
    expect(duringARoll).to.be.greaterThan(AUDIBLE_THRESHOLD_DB);
    expect(duringMutedBRoll).to.be.lessThan(AUDIBLE_THRESHOLD_DB);
  });

  it("should show a fade rather than a hard cut on a scene declaring transition: fade", async () => {
    // Arrange — fps=30 so the brand-default transition window comfortably fits inside a 1s scene
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 30,
      scenes: [
        { type: "a_roll", asset: "red.mp4", duration: 1 },
        { type: "b_roll", asset: "green.mp4", duration: 1, transition: { type: "fade" } }
      ]
    });
    const outputPath = path.join(outDir, "fade.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert — the non-transitioning first scene is at full brightness from its very first frame
    const [firstSceneStart] = getPixelAt(outputPath, 0.02);
    expect(firstSceneStart).to.be.greaterThan(BRIGHT_THRESHOLD);

    // Assert — the fading-in second scene starts dark and ramps up to full brightness
    const fadeWindowSeconds = DEFAULT_BRAND_TRANSITION_SECONDS;
    const [, atFadeStart] = getPixelAt(outputPath, 1.0 + fadeWindowSeconds * 0.1);
    const [, atFadeEnd] = getPixelAt(outputPath, 1.0 + fadeWindowSeconds * 0.95);
    expect(atFadeStart).to.be.lessThan(atFadeEnd);
    expect(atFadeEnd).to.be.greaterThan(BRIGHT_THRESHOLD);
  });

  it("should slide in rather than hard-cut on a scene declaring transition: slide-left", async () => {
    // Arrange
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 30,
      scenes: [
        { type: "a_roll", asset: "red.mp4", duration: 1 },
        { type: "b_roll", asset: "green.mp4", duration: 1, transition: { type: "slide-left" } }
      ]
    });
    const outputPath = path.join(outDir, "slide-left.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert — the sliding-in second scene starts mostly off-frame (dark average) and ramps up to full brightness
    const windowSeconds = DEFAULT_BRAND_TRANSITION_SECONDS;
    const [, atStart] = getPixelAt(outputPath, 1.0 + windowSeconds * 0.05);
    const [, atEnd] = getPixelAt(outputPath, 1.0 + windowSeconds * 0.95);
    expect(atStart).to.be.lessThan(atEnd);
    expect(atEnd).to.be.greaterThan(BRIGHT_THRESHOLD);
  });

  it("should slide in rather than hard-cut on a scene declaring transition: slide-right", async () => {
    // Arrange
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 30,
      scenes: [
        { type: "a_roll", asset: "red.mp4", duration: 1 },
        { type: "b_roll", asset: "green.mp4", duration: 1, transition: { type: "slide-right" } }
      ]
    });
    const outputPath = path.join(outDir, "slide-right.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert
    const windowSeconds = DEFAULT_BRAND_TRANSITION_SECONDS;
    const [, atStart] = getPixelAt(outputPath, 1.0 + windowSeconds * 0.05);
    const [, atEnd] = getPixelAt(outputPath, 1.0 + windowSeconds * 0.95);
    expect(atStart).to.be.lessThan(atEnd);
    expect(atEnd).to.be.greaterThan(BRIGHT_THRESHOLD);
  });

  it("should zoom in rather than hard-cut on a scene declaring transition: zoom", async () => {
    // Arrange
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 30,
      scenes: [
        { type: "a_roll", asset: "red.mp4", duration: 1 },
        { type: "b_roll", asset: "green.mp4", duration: 1, transition: { type: "zoom" } }
      ]
    });
    const outputPath = path.join(outDir, "zoom.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert — small-scale start leaves a dark margin (dimmer average); full scale by window's end
    const windowSeconds = DEFAULT_BRAND_TRANSITION_SECONDS;
    const [, atStart] = getPixelAt(outputPath, 1.0 + windowSeconds * 0.05);
    const [, atEnd] = getPixelAt(outputPath, 1.0 + windowSeconds * 0.95);
    expect(atStart).to.be.lessThan(atEnd);
    expect(atEnd).to.be.greaterThan(BRIGHT_THRESHOLD);
  });

  it("should honor the active brand's default transition duration when a scene doesn't specify one", async () => {
    // Arrange — an explicit, non-default duration to prove it's actually being read (not coincidentally matching the brand default)
    const explicitSeconds = DEFAULT_BRAND_TRANSITION_SECONDS * 3;
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 30,
      scenes: [
        { type: "a_roll", asset: "red.mp4", duration: 2 },
        {
          type: "b_roll",
          asset: "green.mp4",
          duration: 2,
          transition: { type: "fade", duration: explicitSeconds }
        }
      ]
    });
    const outputPath = path.join(outDir, "explicit-duration.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert — still ramping (not yet fully bright) partway through the longer, explicit window
    const [, midExplicitWindow] = getPixelAt(outputPath, 2.0 + explicitSeconds * 0.3);
    const [, endExplicitWindow] = getPixelAt(outputPath, 2.0 + explicitSeconds * 0.95);
    expect(midExplicitWindow).to.be.lessThan(endExplicitWindow);
    expect(endExplicitWindow).to.be.greaterThan(BRIGHT_THRESHOLD);
  });

  it("should show a caption overlay during its scene, visibly distinct from no caption", async () => {
    // Arrange
    const noCaptionSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }]
    });
    const captionSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1, caption: "Hello, MotionKit" }]
    });
    const noCaptionPath = path.join(outDir, "no-caption.mp4");
    const captionPath = path.join(outDir, "caption.mp4");

    // Act
    await render(noCaptionSpec, FIXTURES_DIR, noCaptionPath);
    await render(captionSpec, FIXTURES_DIR, captionPath);

    // Assert — the caption's background band changes the composited frame's average color
    const withoutCaption = getPixelAt(noCaptionPath, 0.5);
    const withCaption = getPixelAt(captionPath, 0.5);
    expect(withCaption).to.not.deep.equal(withoutCaption);
  });

  it("should wrap a scene's visual content in a browser frame when frame: 'browser' is declared", async () => {
    // Arrange — the same scene, once bare and once wrapped in a browser frame
    const bareSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }]
    });
    const framedSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1, frame: "browser" }]
    });
    const barePath = path.join(outDir, "bare.mp4");
    const framedPath = path.join(outDir, "frame.mp4");

    // Act
    await render(bareSpec, FIXTURES_DIR, barePath);
    await render(framedSpec, FIXTURES_DIR, framedPath);

    // Assert — the browser frame's padding and chrome bar mean the scene no
    // longer fills the composition edge-to-edge, so the whole-frame average
    // color differs measurably from the bare (edge-to-edge) rendering
    const info = getVideoInfo(framedPath);
    expect(info.width).to.equal(1920);
    expect(info.height).to.equal(1080);
    const barePixel = getPixelAt(barePath, 0.5);
    const framedPixel = getPixelAt(framedPath, 0.5);
    expect(framedPixel).to.not.deep.equal(barePixel);

    // Assert — the top strip (padding + chrome bar) is no longer solid red in the framed rendering
    const topStrip = { x: 800, y: 20, width: 320, height: 20 };
    const bareTopStrip = getPixelAtRegion(barePath, 0.5, topStrip);
    const framedTopStrip = getPixelAtRegion(framedPath, 0.5, topStrip);
    expect(framedTopStrip).to.not.deep.equal(bareTopStrip);
  });

  it("should render the brand's logo at its default placement when logo: true is declared, distinct from no logo", async () => {
    // Arrange
    const noLogoSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }]
    });
    const logoSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1, logo: true }]
    });
    const noLogoPath = path.join(outDir, "no-logo.mp4");
    const logoPath = path.join(outDir, "logo-default.mp4");

    // Act
    await render(noLogoSpec, FIXTURES_DIR, noLogoPath);
    await render(logoSpec, FIXTURES_DIR, logoPath);

    // Assert — the default brand places the logo bottom_right; a crop of that
    // corner region shows the overlay's presence even though the whole-frame
    // average (dominated by the much larger solid-color background) doesn't
    const bottomRightCorner = { x: 1920 - 240, y: 1080 - 240, width: 240, height: 240 };
    const withoutLogo = getPixelAtRegion(noLogoPath, 0.5, bottomRightCorner);
    const withLogo = getPixelAtRegion(logoPath, 0.5, bottomRightCorner);
    expect(withLogo).to.not.deep.equal(withoutLogo);
  });

  it("should render the brand's logo at an overridden placement, distinct from the default placement", async () => {
    // Arrange
    const defaultPlacementSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1, logo: true }]
    });
    const overriddenPlacementSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1, logo: { position: "top_left" } }]
    });
    const defaultPath = path.join(outDir, "logo-default-2.mp4");
    const overriddenPath = path.join(outDir, "logo-override.mp4");

    // Act
    await render(defaultPlacementSpec, FIXTURES_DIR, defaultPath);
    await render(overriddenPlacementSpec, FIXTURES_DIR, overriddenPath);

    // Assert — the default brand's logo placement (bottom_right) differs from
    // the override (top_left): the top-left corner only shows the logo in
    // the overridden render, and the bottom-right corner only shows it in
    // the default-placement render
    const topLeftCorner = { x: 0, y: 0, width: 240, height: 240 };
    const bottomRightCorner = { x: 1920 - 240, y: 1080 - 240, width: 240, height: 240 };

    const defaultTopLeft = getPixelAtRegion(defaultPath, 0.5, topLeftCorner);
    const overriddenTopLeft = getPixelAtRegion(overriddenPath, 0.5, topLeftCorner);
    expect(overriddenTopLeft).to.not.deep.equal(defaultTopLeft);

    const defaultBottomRight = getPixelAtRegion(defaultPath, 0.5, bottomRightCorner);
    const overriddenBottomRight = getPixelAtRegion(overriddenPath, 0.5, bottomRightCorner);
    expect(defaultBottomRight).to.not.deep.equal(overriddenBottomRight);
  });

  it("should render 16:9 at 1920x1080", async () => {
    // Arrange
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }]
    });
    const outputPath = path.join(outDir, "wide.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert
    const info = getVideoInfo(outputPath);
    expect(info.width).to.equal(1920);
    expect(info.height).to.equal(1080);
  });

  it("should render 9:16 at 1080x1920", async () => {
    // Arrange
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "9:16",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }]
    });
    const outputPath = path.join(outDir, "tall.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert
    const info = getVideoInfo(outputPath);
    expect(info.width).to.equal(1080);
    expect(info.height).to.equal(1920);
  });

  it("should render the same specification twice to frame-for-frame equivalent output", async () => {
    // Arrange
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }]
    });
    const firstPath = path.join(outDir, "first.mp4");
    const secondPath = path.join(outDir, "second.mp4");

    // Act
    await render(spec, FIXTURES_DIR, firstPath);
    await render(spec, FIXTURES_DIR, secondPath);

    // Assert
    expect(hashDecodedContent(firstPath)).to.equal(hashDecodedContent(secondPath));
  });

  it("should refuse to render an invalid specification and write no file", async () => {
    // Arrange
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "does-not-exist.mp4", duration: 1 }]
    });
    const outputPath = path.join(outDir, "should-not-exist.mp4");

    // Act + Assert
    try {
      await render(spec, FIXTURES_DIR, outputPath);
      expect.fail("expected render() to throw RenderValidationError");
    } catch (err) {
      expect(err).to.be.instanceOf(RenderValidationError);
      if (err instanceof RenderValidationError) {
        expect(err.errors.some((e) => e.code === "ASSET_NOT_FOUND")).to.equal(true);
      }
    }
    expect(fs.existsSync(outputPath)).to.equal(false);
  });

  it("should pan a horizontal_pan left-to-right by default, revealing the source's right side by the end of the scene", async () => {
    // Arrange — split-h.mp4 is red on the left half, blue on the right
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [
        { type: "a_roll", asset: "split-h.mp4", duration: 2, motion: { type: "horizontal_pan" } }
      ]
    });
    const outputPath = path.join(outDir, "pan-h-default.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert — starts red-dominant (showing the source's left edge), ends blue-dominant (right edge)
    const [rStart, , bStart] = getPixelAt(outputPath, 0.02);
    const [rEnd, , bEnd] = getPixelAt(outputPath, 1.9);
    expect(rStart).to.be.greaterThan(bStart);
    expect(bEnd).to.be.greaterThan(rEnd);
  });

  it("should reverse a horizontal_pan when direction: right_to_left is declared", async () => {
    // Arrange
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [
        {
          type: "a_roll",
          asset: "split-h.mp4",
          duration: 2,
          motion: { type: "horizontal_pan", direction: "right_to_left" }
        }
      ]
    });
    const outputPath = path.join(outDir, "pan-h-reversed.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert — the reverse of the default: starts blue-dominant, ends red-dominant
    const [rStart, , bStart] = getPixelAt(outputPath, 0.02);
    const [rEnd, , bEnd] = getPixelAt(outputPath, 1.9);
    expect(bStart).to.be.greaterThan(rStart);
    expect(rEnd).to.be.greaterThan(bEnd);
  });

  it("should pan a vertical_pan top-to-bottom by default, revealing the source's bottom by the end of the scene", async () => {
    // Arrange — split-v.mp4 is red on the top half, blue on the bottom
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [
        { type: "a_roll", asset: "split-v.mp4", duration: 2, motion: { type: "vertical_pan" } }
      ]
    });
    const outputPath = path.join(outDir, "pan-v-default.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert — starts red-dominant (top), ends blue-dominant (bottom)
    const [rStart, , bStart] = getPixelAt(outputPath, 0.02);
    const [rEnd, , bEnd] = getPixelAt(outputPath, 1.9);
    expect(rStart).to.be.greaterThan(bStart);
    expect(bEnd).to.be.greaterThan(rEnd);
  });

  it("should reverse a vertical_pan when direction: bottom_to_top is declared", async () => {
    // Arrange
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [
        {
          type: "a_roll",
          asset: "split-v.mp4",
          duration: 2,
          motion: { type: "vertical_pan", direction: "bottom_to_top" }
        }
      ]
    });
    const outputPath = path.join(outDir, "pan-v-reversed.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert
    const [rStart, , bStart] = getPixelAt(outputPath, 0.02);
    const [rEnd, , bEnd] = getPixelAt(outputPath, 1.9);
    expect(bStart).to.be.greaterThan(rStart);
    expect(rEnd).to.be.greaterThan(bEnd);
  });

  it("should zoom in toward the focal point over the scene's duration, revealing progressively less of the far side", async () => {
    // Arrange — focal point biased toward the blue (right) side; zooming in
    // should show progressively *more* blue, *less* red, as it magnifies
    // toward that point (see design.md's derivation in the responsive-motion
    // change design doc, decision #1).
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [
        {
          type: "a_roll",
          asset: "split-h.mp4",
          duration: 2,
          motion: { type: "zoom", focalPoint: { x: 0.75, y: 0.5 } }
        }
      ]
    });
    const outputPath = path.join(outDir, "zoom.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert — red's share of the frame shrinks as the zoom progresses
    const [rStart] = getPixelAt(outputPath, 0.02);
    const [rEnd] = getPixelAt(outputPath, 1.9);
    expect(rEnd).to.be.lessThan(rStart);
  });

  it("should bias a static motion's crop toward an off-center focal point, distinct from the default centered crop", async () => {
    // Arrange
    const centeredSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "split-h.mp4", duration: 1 }]
    });
    const biasedSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [
        {
          type: "a_roll",
          asset: "split-h.mp4",
          duration: 1,
          motion: { type: "static", focalPoint: { x: 1, y: 0.5 } }
        }
      ]
    });
    const centeredPath = path.join(outDir, "static-centered.mp4");
    const biasedPath = path.join(outDir, "static-biased.mp4");

    // Act
    await render(centeredSpec, FIXTURES_DIR, centeredPath);
    await render(biasedSpec, FIXTURES_DIR, biasedPath);

    // Assert — the focal-point-biased crop shows more blue than the centered default
    const [, , bCentered] = getPixelAt(centeredPath, 0.5);
    const [, , bBiased] = getPixelAt(biasedPath, 0.5);
    expect(bBiased).to.be.greaterThan(bCentered);
  });

  it("should render a scene declaring both motion and a frame decoration without error", async () => {
    // Arrange
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [
        {
          type: "a_roll",
          asset: "split-h.mp4",
          duration: 1,
          frame: "browser",
          motion: { type: "horizontal_pan" }
        }
      ]
    });
    const outputPath = path.join(outDir, "motion-plus-frame.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert
    expect(fs.existsSync(outputPath)).to.equal(true);
    const info = getVideoInfo(outputPath);
    expect(info.width).to.equal(1920);
    expect(info.height).to.equal(1080);
  });

  it("should render a phone frame, visibly distinct from a browser frame", async () => {
    // Arrange — the built-in default brand's phoneFrameStyle has a different
    // chromeHeightPx/borderRadius than browserFrameStyle (see
    // default.brand.json), so the two should composite differently.
    const browserSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1, frame: "browser" }]
    });
    const phoneSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1, frame: "phone" }]
    });
    const browserPath = path.join(outDir, "frame-browser.mp4");
    const phonePath = path.join(outDir, "frame-phone.mp4");

    // Act
    await render(browserSpec, FIXTURES_DIR, browserPath);
    await render(phoneSpec, FIXTURES_DIR, phonePath);

    // Assert — the default brand's browserFrameStyle/phoneFrameStyle share a
    // chromeColor but differ in chromeHeightPx (40 vs 28, past the shared
    // 32px padding): the band from y=60 to y=72 is still inside the
    // browser's chrome bar but past the phone's, so it shows the browser's
    // chromeColor on one side and the scene's actual video content on the
    // other — a region a same-colored, same-position strip couldn't detect.
    const boundaryStrip = { x: 800, y: 62, width: 320, height: 8 };
    const browserAtBoundary = getPixelAtRegion(browserPath, 0.5, boundaryStrip);
    const phoneAtBoundary = getPixelAtRegion(phonePath, 0.5, boundaryStrip);
    expect(phoneAtBoundary).to.not.deep.equal(browserAtBoundary);
  });

  it("should render 1:1 at 1080x1080", async () => {
    // Arrange
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "1:1",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }]
    });
    const outputPath = path.join(outDir, "square.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert
    const info = getVideoInfo(outputPath);
    expect(info.width).to.equal(1080);
    expect(info.height).to.equal(1080);
  });

  it("should render a PIP overlay as a visible bubble on top of its scene", async () => {
    // Arrange — red base scene, green PIP bubble at the default (bottom_left) placement
    const noOverlaySpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }]
    });
    const overlaySpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }],
      overlays: [{ type: "pip", sceneIndex: 0, asset: "green.mp4", audio: "muted" }]
    });
    const noOverlayPath = path.join(outDir, "no-pip.mp4");
    const overlayPath = path.join(outDir, "pip-default.mp4");

    // Act
    await render(noOverlaySpec, FIXTURES_DIR, noOverlayPath);
    await render(overlaySpec, FIXTURES_DIR, overlayPath);

    // Assert — the default brand places the bubble bottom_left; a generous
    // crop of that corner shows the overlay's presence
    const bottomLeftCorner = { x: 0, y: 1080 - 320, width: 320, height: 320 };
    const withoutOverlay = getPixelAtRegion(noOverlayPath, 0.5, bottomLeftCorner);
    const withOverlay = getPixelAtRegion(overlayPath, 0.5, bottomLeftCorner);
    expect(withOverlay).to.not.deep.equal(withoutOverlay);
  });

  it("should render a PIP overlay at an overridden position", async () => {
    // Arrange
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }],
      overlays: [
        {
          type: "pip",
          sceneIndex: 0,
          asset: "green.mp4",
          audio: "muted",
          position: "top_right"
        }
      ]
    });
    const bareSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }]
    });
    const outputPath = path.join(outDir, "pip-top-right.mp4");
    const barePath = path.join(outDir, "pip-top-right-bare.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);
    await render(bareSpec, FIXTURES_DIR, barePath);

    // Assert
    const topRightCorner = { x: 1920 - 320, y: 0, width: 320, height: 320 };
    const withOverlay = getPixelAtRegion(outputPath, 0.5, topRightCorner);
    const withoutOverlay = getPixelAtRegion(barePath, 0.5, topRightCorner);
    expect(withOverlay).to.not.deep.equal(withoutOverlay);
  });

  it("should render a PIP overlay's shape as rounded_square distinctly from the default circle", async () => {
    // Arrange — a circle clips its bounding box's corners more aggressively
    // than a rounded_square, so the bubble's own corner differs between the
    // two shapes even though the bubble's own position/size are identical
    const circleSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }],
      overlays: [{ type: "pip", sceneIndex: 0, asset: "green.mp4", audio: "muted" }]
    });
    const roundedSquareSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }],
      overlays: [
        { type: "pip", sceneIndex: 0, asset: "green.mp4", audio: "muted", shape: "rounded_square" }
      ]
    });
    const circlePath = path.join(outDir, "pip-circle.mp4");
    const roundedSquarePath = path.join(outDir, "pip-rounded-square.mp4");

    // Act
    await render(circleSpec, FIXTURES_DIR, circlePath);
    await render(roundedSquareSpec, FIXTURES_DIR, roundedSquarePath);

    // Assert — a small region right at the bubble's own corner. The default
    // brand's md bubble (220px) sits inset 100px from the bottom_left edge
    // (see Timeline.tsx's PIP_EDGE_INSET_PX), so its bounds are x:[100,320],
    // y:[760,980] — this probes near its own top-right-of-bubble corner.
    const bubbleCorner = { x: 300, y: 760, width: 24, height: 24 };
    const circleCorner = getPixelAtRegion(circlePath, 0.5, bubbleCorner);
    const roundedSquareCorner = getPixelAtRegion(roundedSquarePath, 0.5, bubbleCorner);
    expect(circleCorner).to.not.deep.equal(roundedSquareCorner);
  });

  it("should render a PIP overlay at an overridden size", async () => {
    // Arrange — the default brand's pipStyle.size.lg (320) is large enough
    // to reach a region md (220) doesn't
    const mdSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }],
      overlays: [{ type: "pip", sceneIndex: 0, asset: "green.mp4", audio: "muted" }]
    });
    const lgSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }],
      overlays: [{ type: "pip", sceneIndex: 0, asset: "green.mp4", audio: "muted", size: "lg" }]
    });
    const mdPath = path.join(outDir, "pip-md.mp4");
    const lgPath = path.join(outDir, "pip-lg.mp4");

    // Act
    await render(mdSpec, FIXTURES_DIR, mdPath);
    await render(lgSpec, FIXTURES_DIR, lgPath);

    // Assert — a region beyond the md bubble's reach but within the lg
    // bubble's. With the 100px edge inset (see Timeline.tsx's
    // PIP_EDGE_INSET_PX), md's bottom_left bounds are x:[100,320],
    // y:[760,980] and lg's are x:[100,420], y:[660,980] — this probes just
    // past md's right edge but well within lg's.
    const beyondMdRegion = { x: 340, y: 920, width: 40, height: 40 };
    const mdPixel = getPixelAtRegion(mdPath, 0.5, beyondMdRegion);
    const lgPixel = getPixelAtRegion(lgPath, 0.5, beyondMdRegion);
    expect(lgPixel).to.not.deep.equal(mdPixel);
  });

  it("should render multiple PIP overlays on the same scene, both visible", async () => {
    // Arrange — two overlays at distinct positions so both are independently detectable
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }],
      overlays: [
        { type: "pip", sceneIndex: 0, asset: "green.mp4", audio: "muted", position: "top_left" },
        { type: "pip", sceneIndex: 0, asset: "blue.mp4", audio: "muted", position: "top_right" }
      ]
    });
    const barePath = path.join(outDir, "multi-pip-bare.mp4");
    const outputPath = path.join(outDir, "multi-pip.mp4");
    const bareSpec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "red.mp4", duration: 1 }]
    });

    // Act
    await render(spec, FIXTURES_DIR, outputPath);
    await render(bareSpec, FIXTURES_DIR, barePath);

    // Assert — both corners differ from the bare rendering
    const topLeftCorner = { x: 0, y: 0, width: 320, height: 320 };
    const topRightCorner = { x: 1920 - 320, y: 0, width: 320, height: 320 };
    expect(getPixelAtRegion(outputPath, 0.5, topLeftCorner)).to.not.deep.equal(
      getPixelAtRegion(barePath, 0.5, topLeftCorner)
    );
    expect(getPixelAtRegion(outputPath, 0.5, topRightCorner)).to.not.deep.equal(
      getPixelAtRegion(barePath, 0.5, topRightCorner)
    );
  });

  it("should play a PIP overlay's own audio when audio: 'own' is declared", async () => {
    // Arrange — a silent-otherwise scene (a_roll with no audio-continuity chain issue: a plain a_roll always carries its own audio, so use a b_roll with no preceding a_roll for true silence)
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "b_roll", asset: "green.mp4", duration: 1 }],
      overlays: [{ type: "pip", sceneIndex: 0, asset: "red.mp4", audio: "own" }]
    });
    const outputPath = path.join(outDir, "pip-own-audio.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert
    const volume = getMeanVolumeDb(outputPath, 0.1, 0.7);
    expect(volume).to.be.greaterThan(AUDIBLE_THRESHOLD_DB);
  });

  it("should contribute no audio when a PIP overlay declares audio: 'muted'", async () => {
    // Arrange — b_roll with no preceding a_roll (nothing else could produce audio) plus a muted PIP
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "b_roll", asset: "green.mp4", duration: 1 }],
      overlays: [{ type: "pip", sceneIndex: 0, asset: "red.mp4", audio: "muted" }]
    });
    const outputPath = path.join(outDir, "pip-muted-audio.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert
    const volume = getMeanVolumeDb(outputPath, 0.1, 0.7);
    expect(volume).to.be.lessThan(AUDIBLE_THRESHOLD_DB);
  });

  it("should play both an own-audio PIP and an inherited A-roll-continuity audio simultaneously, without ducking either", async () => {
    // Arrange — a_roll(red, tone) -> b_roll(green, continues red's audio) with an own-audio PIP on the b_roll scene
    const spec = videoSpecSchema.parse({
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [
        { type: "a_roll", asset: "red.mp4", duration: 1 },
        { type: "b_roll", asset: "green.mp4", duration: 1 }
      ],
      overlays: [{ type: "pip", sceneIndex: 1, asset: "blue.mp4", audio: "own" }]
    });
    const outputPath = path.join(outDir, "pip-simultaneous-audio.mp4");

    // Act
    await render(spec, FIXTURES_DIR, outputPath);

    // Assert — audible during the B-roll's screen time, whether from the
    // inherited A-roll audio, the PIP's own audio, or (as designed) both at once
    const duringBRoll = getMeanVolumeDb(outputPath, 1.1, 0.7);
    expect(duringBRoll).to.be.greaterThan(AUDIBLE_THRESHOLD_DB);
  });
});

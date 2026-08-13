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
});

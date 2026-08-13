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
import { render, RenderValidationError } from "../../src/rendering/render.js";
import { videoSpecSchema } from "../../src/video-spec/schema.js";
import { FADE_DURATION_IN_FRAMES } from "../../src/rendering/Timeline.js";
import { FIXTURES_DIR, generateSampleVideo } from "../fixtures/generateSampleVideo.js";
import { getMeanVolumeDb, getPixelAt, getVideoInfo, hashDecodedContent } from "./mediaProbe.js";

const AUDIBLE_THRESHOLD_DB = -50;
const BRIGHT_THRESHOLD = 80;

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
    // Arrange — fps=30 so the fixed 15-frame fade window comfortably fits inside a 1s scene
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
    const fadeWindowSeconds = FADE_DURATION_IN_FRAMES / spec.fps;
    const [, atFadeStart] = getPixelAt(outputPath, 1.0 + fadeWindowSeconds * 0.1);
    const [, atFadeEnd] = getPixelAt(outputPath, 1.0 + fadeWindowSeconds * 0.95);
    expect(atFadeStart).to.be.lessThan(atFadeEnd);
    expect(atFadeEnd).to.be.greaterThan(BRIGHT_THRESHOLD);
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

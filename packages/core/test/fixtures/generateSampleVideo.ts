/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Synthesizes short, deterministic test clips with `ffmpeg` (a transitive
 * dependency of `@remotion/renderer`'s toolchain) instead of committing real
 * video binaries to git. See design.md decision #4 in the `foundation`
 * OpenSpec change: every fixture is reproducible from a one-line command,
 * keeping the repo lean.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Directory the generated fixtures are written to. Gitignored — never commit its contents. */
export const FIXTURES_DIR = path.resolve(import.meta.dirname, "../../.fixtures");

export interface SampleVideoOptions {
  /** File name (e.g. `a-roll.mp4`) written under `FIXTURES_DIR`. */
  name: string;
  /** Clip duration in seconds. Kept short (1-3s) so the render test suite stays fast. */
  duration: number;
  /** Frame width in pixels. */
  width?: number;
  /** Frame height in pixels. */
  height?: number;
  /** Frame rate. */
  fps?: number;
  /** Sine wave frequency (Hz) for the synthesized audio track — distinct frequencies make clips distinguishable when probing audio. */
  toneHz?: number;
  /**
   * The `lavfi` visual source. `"testsrc"` is a generic test pattern; a
   * solid `color` (e.g. `"red"`) makes clips trivially distinguishable by
   * sampling a single pixel, which the rendering tests use to assert scene
   * order. `"split-horizontal"`/`"split-vertical"` are two-color halves
   * (`color`/`secondColor`) — used to verify pan *direction*: a whole-frame
   * pixel average shifts from one color toward the other as the crop window
   * moves across the source, which a single solid color can't demonstrate.
   */
  visual?: "testsrc" | "color" | "split-horizontal" | "split-vertical";
  /** Solid fill color when `visual: "color"`, or the first half's color when `visual: "split-*"` (any ffmpeg color name, e.g. `"red"`). */
  color?: string;
  /** The second half's color when `visual: "split-*"`. */
  secondColor?: string;
}

/**
 * Generates (or reuses, if already present) a short synthetic MP4 from
 * `ffmpeg`'s `lavfi` virtual input devices — a visual pattern (`testsrc` or
 * a solid `color`) plus a `sine` tone audio track — no external media
 * needed.
 *
 * @returns The absolute path to the generated clip.
 */
export function generateSampleVideo(options: SampleVideoOptions): string {
  const {
    name,
    duration,
    width = 320,
    height = 180,
    fps = 30,
    toneHz = 440,
    visual = "testsrc",
    color = "white",
    secondColor = "blue"
  } = options;

  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const outputPath = path.join(FIXTURES_DIR, name);

  if (fs.existsSync(outputPath)) {
    return outputPath;
  }

  if (visual === "split-horizontal" || visual === "split-vertical") {
    const isHorizontal = visual === "split-horizontal";
    const halfWidth = isHorizontal ? Math.floor(width / 2) : width;
    const halfHeight = isHorizontal ? height : Math.floor(height / 2);
    const stackFilter = isHorizontal ? "hstack" : "vstack";

    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `color=c=${color}:size=${halfWidth}x${halfHeight}:rate=${fps}:duration=${duration}`,
        "-f",
        "lavfi",
        "-i",
        `color=c=${secondColor}:size=${halfWidth}x${halfHeight}:rate=${fps}:duration=${duration}`,
        "-f",
        "lavfi",
        "-i",
        `sine=frequency=${toneHz}:duration=${duration}`,
        "-filter_complex",
        `[0:v][1:v]${stackFilter}=inputs=2[v]`,
        "-map",
        "[v]",
        "-map",
        "2:a",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        outputPath
      ],
      { stdio: "pipe" }
    );

    return outputPath;
  }

  const visualSource =
    visual === "color"
      ? `color=c=${color}:size=${width}x${height}:rate=${fps}:duration=${duration}`
      : `testsrc=duration=${duration}:size=${width}x${height}:rate=${fps}`;

  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      visualSource,
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${toneHz}:duration=${duration}`,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      outputPath
    ],
    { stdio: "pipe" }
  );

  return outputPath;
}

/** Removes the generated fixtures directory entirely. */
export function cleanSampleVideos(): void {
  fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
}

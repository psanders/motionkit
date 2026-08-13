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
   * The `lavfi` visual source. `"testsrc"` (the default) is a generic test
   * pattern; a solid `color` (e.g. `"red"`) makes clips trivially
   * distinguishable by sampling a single pixel, which the rendering tests
   * use to assert scene order.
   */
  visual?: "testsrc" | "color";
  /** Solid fill color when `visual: "color"` (any ffmpeg color name, e.g. `"red"`). */
  color?: string;
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
    color = "white"
  } = options;

  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const outputPath = path.join(FIXTURES_DIR, name);

  if (fs.existsSync(outputPath)) {
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

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Small `ffmpeg`/`ffprobe` wrappers used only by the rendering test suite to
 * make assertions about a rendered MP4's actual content (dimensions,
 * duration, per-timestamp pixel color, per-segment audio level, and a
 * content hash of the decoded streams) — never by production code.
 */
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";

/** Raw decoded video/audio pipes can be large; don't let Node's default ~1MB `maxBuffer` truncate them. */
const LARGE_BUFFER = 1024 * 1024 * 1024;

export interface VideoInfo {
  width: number;
  height: number;
  durationSeconds: number;
}

/** Reads a rendered file's video stream dimensions and container duration via `ffprobe`. */
export function getVideoInfo(filePath: string): VideoInfo {
  const output = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      filePath
    ],
    { encoding: "utf-8" }
  );

  const parsed = JSON.parse(output) as {
    streams: { width: number; height: number }[];
    format: { duration: string };
  };
  const stream = parsed.streams[0];
  if (!stream) throw new Error(`No video stream found in ${filePath}`);

  return {
    width: stream.width,
    height: stream.height,
    durationSeconds: Number(parsed.format.duration)
  };
}

/** Reads the average RGB color of the frame at `timeSeconds`, downscaled to a single pixel. */
export function getPixelAt(filePath: string, timeSeconds: number): [number, number, number] {
  const buffer = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-ss",
    String(timeSeconds),
    "-i",
    filePath,
    "-vframes",
    "1",
    "-vf",
    "scale=1:1",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "pipe:1"
  ]);

  return [buffer[0] ?? 0, buffer[1] ?? 0, buffer[2] ?? 0];
}

/**
 * Reads the average RGB color of a cropped sub-region of the frame at
 * `timeSeconds`. Small overlays (e.g. a corner logo) don't move a
 * whole-frame average (`getPixelAt`) enough to be reliably distinguishable,
 * so tests that need to detect one crop down to the region it actually
 * occupies first.
 */
export function getPixelAtRegion(
  filePath: string,
  timeSeconds: number,
  region: { x: number; y: number; width: number; height: number }
): [number, number, number] {
  const buffer = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-ss",
    String(timeSeconds),
    "-i",
    filePath,
    "-vframes",
    "1",
    "-vf",
    `crop=${region.width}:${region.height}:${region.x}:${region.y},scale=1:1`,
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "pipe:1"
  ]);

  return [buffer[0] ?? 0, buffer[1] ?? 0, buffer[2] ?? 0];
}

/** Reads the mean volume (in dB; more negative = quieter, silence approaches -91dB) of a segment. */
export function getMeanVolumeDb(
  filePath: string,
  startSeconds: number,
  durationSeconds: number
): number {
  // ffmpeg writes filter analysis (volumedetect) to stderr, not stdout — use
  // spawnSync directly so stderr is captured rather than discarded.
  const result = spawnSync(
    "ffmpeg",
    [
      "-ss",
      String(startSeconds),
      "-t",
      String(durationSeconds),
      "-i",
      filePath,
      "-af",
      "volumedetect",
      "-f",
      "null",
      "-"
    ],
    { encoding: "utf-8", maxBuffer: LARGE_BUFFER }
  );

  const match = /mean_volume:\s*(-?\d+(\.\d+)?)\s*dB/.exec(result.stderr ?? "");
  if (!match?.[1]) return -Infinity;
  return Number(match[1]);
}

/**
 * SHA-256 of the decoded raw video (rgb24, downscaled to keep the pipe
 * small) and audio (s16le) streams — content-only, ignores container
 * metadata such as encode timestamps that can differ trivially run to run.
 */
export function hashDecodedContent(filePath: string): string {
  const video = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      filePath,
      "-map",
      "0:v:0",
      "-vf",
      "scale=64:64",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "pipe:1"
    ],
    { maxBuffer: LARGE_BUFFER }
  );
  const audio = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      filePath,
      "-map",
      "0:a:0",
      "-f",
      "s16le",
      "-ac",
      "1",
      "-ar",
      "44100",
      "pipe:1"
    ],
    { maxBuffer: LARGE_BUFFER }
  );

  const hash = crypto.createHash("sha256");
  hash.update(video);
  hash.update(audio);
  return hash.digest("hex");
}

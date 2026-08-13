/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * A minimal synthetic MP4 generator for the MCP package's own tests — mirrors
 * `packages/cli/test/support/generateFixture.ts` at the same small scope
 * (just enough to prove `render_video` succeeds end to end). Kept
 * package-local rather than importing across package test directories.
 */
import { execFileSync } from "node:child_process";

/** Synthesizes a tiny, short synthetic MP4 at `outputPath` via `ffmpeg`'s `lavfi` sources. */
export function generateFixtureVideo(outputPath: string): void {
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=1:size=160x90:rate=10",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=1",
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
}

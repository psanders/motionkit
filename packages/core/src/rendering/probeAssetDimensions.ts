/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Reads a source asset's actual video dimensions via `ffprobe` — the crop/
 * pan/zoom math in `cropTransform.ts` needs the real source size, not just
 * the target composition's. See design.md decision #2 in the
 * `responsive-motion` OpenSpec change: `ffprobe` is already a hard
 * dependency of this toolchain (Remotion's own renderer requires it), so
 * this adds no new install requirement. Only `render()` calls this —
 * `validate()`'s checks are pure bounds/enum checks against the spec
 * document itself, never against the asset.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

export interface AssetDimensions {
  width: number;
  height: number;
}

/** Per-render cache, keyed by resolved asset path — a spec can reference the same asset in multiple scenes; no reason to shell out twice. Module-level so it's shared across calls within one render() invocation, cleared per process (renders don't span processes). */
const dimensionsCache = new Map<string, AssetDimensions>();

/** Probes `assetPath`'s video stream dimensions. Caches by the resolved absolute path. */
export function probeAssetDimensions(assetPath: string): AssetDimensions {
  const resolvedPath = path.resolve(assetPath);
  const cached = dimensionsCache.get(resolvedPath);
  if (cached) return cached;

  const output = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      resolvedPath
    ],
    { encoding: "utf-8" }
  );

  const parsed = JSON.parse(output) as { streams: { width: number; height: number }[] };
  const stream = parsed.streams[0];
  if (!stream) throw new Error(`No video stream found in ${resolvedPath}`);

  const dimensions = { width: stream.width, height: stream.height };
  dimensionsCache.set(resolvedPath, dimensions);
  return dimensions;
}

/** Clears the per-process dimension cache. Test-only — production renders never need to invalidate it. */
export function clearAssetDimensionsCache(): void {
  dimensionsCache.clear();
}

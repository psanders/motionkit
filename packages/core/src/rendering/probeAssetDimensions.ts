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
 *
 * Also home to `probeAssetDurationSeconds()` and `checkSourceRangeFitsAsset()`
 * (see design.md decision #3 in the `source-offset-trim` OpenSpec change):
 * the `sourceStartSeconds`/`sourceEndSeconds` bounds check needs an asset's
 * real, measured duration, which — like real dimensions — only `ffprobe` can
 * answer, so it's colocated here rather than in `validate.ts` (deliberately
 * synchronous and asset-blind beyond `fs.existsSync`).
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import type { StructuredError } from "../validation/errors.js";

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

/** Per-render cache, keyed by resolved asset path, mirroring `dimensionsCache` above — a separate cache since dimension-only callers (the crop/pan/zoom path) shouldn't pay for or depend on a duration probe, and vice versa. */
const durationCache = new Map<string, number>();

/** Probes `assetPath`'s real duration in seconds via `ffprobe`. Caches by the resolved absolute path. */
export function probeAssetDurationSeconds(assetPath: string): number {
  const resolvedPath = path.resolve(assetPath);
  const cached = durationCache.get(resolvedPath);
  if (cached !== undefined) return cached;

  const output = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "json", resolvedPath],
    { encoding: "utf-8" }
  );

  const parsed = JSON.parse(output) as { format?: { duration?: string } };
  const durationSeconds = Number(parsed.format?.duration);
  if (!Number.isFinite(durationSeconds)) {
    throw new Error(`Could not determine duration of ${resolvedPath}`);
  }

  durationCache.set(resolvedPath, durationSeconds);
  return durationSeconds;
}

/** Clears the per-process duration cache. Test-only — production renders never need to invalidate it. */
export function clearAssetDurationCache(): void {
  durationCache.clear();
}

/**
 * Verifies that a scene's or PIP overlay's declared `sourceStartSeconds`/
 * `sourceEndSeconds` (either or both — this is a no-op when neither is
 * declared) fits within `assetPath`'s real, measured duration, and that the
 * resulting span is long enough to cover `durationSeconds` (the scene's or
 * overlay's own on-screen `duration`). Returns a `StructuredError` describing
 * the violation, or `null` when the range fits. `itemPath` is the
 * already-formatted path prefix (e.g. `"scenes.1"`, `"overlays.0"`) the
 * caller wants any resulting error's `path` rooted at — mirrors
 * `validate.ts`'s `checkAssetExists` convention of returning a ready-to-push
 * `StructuredError | null`.
 */
export function checkSourceRangeFitsAsset({
  assetPath,
  sourceStartSeconds,
  sourceEndSeconds,
  durationSeconds,
  itemPath
}: {
  assetPath: string;
  sourceStartSeconds?: number;
  sourceEndSeconds?: number;
  durationSeconds: number;
  itemPath: string;
}): StructuredError | null {
  if (sourceStartSeconds === undefined && sourceEndSeconds === undefined) {
    return null;
  }

  const assetDurationSeconds = probeAssetDurationSeconds(assetPath);
  const start = sourceStartSeconds ?? 0;

  if (start >= assetDurationSeconds) {
    return {
      code: "SOURCE_RANGE_EXCEEDS_ASSET_DURATION",
      message: `sourceStartSeconds (${start}) is at or beyond ${assetPath}'s real duration (${assetDurationSeconds}s).`,
      path: `${itemPath}.sourceStartSeconds`
    };
  }

  const end = Math.min(sourceEndSeconds ?? assetDurationSeconds, assetDurationSeconds);
  const availableSeconds = end - start;

  if (availableSeconds < durationSeconds) {
    return {
      code: "SOURCE_RANGE_EXCEEDS_ASSET_DURATION",
      message: `The source range [${start}, ${sourceEndSeconds ?? "asset end"}] for ${assetPath} covers only ${availableSeconds.toFixed(3)}s of real footage (asset duration ${assetDurationSeconds}s), too short to cover a duration of ${durationSeconds}s.`,
      path: itemPath
    };
  }

  return null;
}

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Renders a validated Video Specification into a deterministic MP4 using
 * Remotion's programmatic renderer: `bundle()` the entry once per spec
 * directory, `selectComposition()` by format, then `renderMedia()` with
 * fixed encoding settings so repeated renders of the same input are
 * frame-for-frame equivalent (see design.md decision #3).
 */
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { loadBrand } from "../brand/registry.js";
import { validate } from "../validation/validate.js";
import type { StructuredError } from "../validation/errors.js";
import type { VideoSpec } from "../video-spec/types.js";
import { resolveBrandAssets } from "./resolveBrandAssets.js";

// The bundler needs the entry's actual file: `.tsx` when running against
// `src/` directly (as the test suite does, via `tsx`), `.js` once this
// package is compiled to `dist/` (as the CLI consumes it).
function resolveEntryPoint(): string {
  const tsxPath = path.join(import.meta.dirname, "remotion.entry.tsx");
  return fs.existsSync(tsxPath) ? tsxPath : path.join(import.meta.dirname, "remotion.entry.js");
}

const ENTRY_POINT = resolveEntryPoint();

/** Thrown by `render()` when the given spec fails `validate()`. Carries the same structured errors validation reports. */
export class RenderValidationError extends Error {
  public readonly code = "RENDER_VALIDATION_ERROR";
  public readonly errors: StructuredError[];

  constructor(errors: StructuredError[]) {
    super(
      `Refusing to render an invalid Video Specification: ${errors.map((e) => e.message).join("; ")}`
    );
    this.name = "RenderValidationError";
    this.errors = errors;
  }
}

/** Maps a Video Specification's format to its registered composition id (see `remotion.entry.tsx`). */
function compositionIdFor(format: VideoSpec["format"]): string {
  return format === "16:9" ? "MotionKit16x9" : "MotionKit9x16";
}

// Bundling the Remotion entry is the expensive, spec-independent part of a
// render; cache the resulting serve URL per spec directory (which becomes
// the bundle's `publicDir`, symlinked rather than copied) so repeated
// renders against the same directory in one process don't re-bundle.
const bundleCache = new Map<string, Promise<string>>();

function getBundleUrl(specDir: string): Promise<string> {
  const key = path.resolve(specDir);
  const cached = bundleCache.get(key);
  if (cached) return cached;

  const bundling = bundle({
    entryPoint: ENTRY_POINT,
    publicDir: key,
    symlinkPublicDir: true,
    // This repo's convention is Node-ESM-style relative imports ending in
    // `.js` even from `.ts`/`.tsx` source (required by `moduleResolution:
    // NodeNext`). Webpack's default resolution doesn't know `.js` can mean
    // "the compiled output of a sibling `.tsx` file" the way `tsx`/Node's
    // loader does, so teach it the same alias.
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        extensionAlias: { ".js": [".js", ".ts", ".tsx"] }
      }
    }),
    onProgress: () => {}
  });
  bundleCache.set(key, bundling);
  return bundling;
}

/**
 * Renders a Video Specification to an MP4 at `outputPath`.
 *
 * @param spec - The Video Specification to render
 * @param specDir - The directory the spec file lives in; scene `asset` paths are resolved (and served) against it
 * @param outputPath - Where to write the rendered MP4
 * @throws {RenderValidationError} if `spec` fails validation — no file is written
 */
export async function render(spec: VideoSpec, specDir: string, outputPath: string): Promise<void> {
  const validation = validate(spec, specDir);

  if (!validation.valid) {
    throw new RenderValidationError(validation.errors);
  }

  // `validate()` above already confirmed `spec.brand` resolves, so
  // `loadBrand` (the throwing counterpart to `findBrand`) is safe here.
  const { brand, brandDir } = loadBrand(spec.brand, specDir);
  const resolvedBrand = resolveBrandAssets(brand, brandDir);

  const serveUrl = await getBundleUrl(specDir);
  const inputProps = { spec, brand: resolvedBrand };

  const composition = await selectComposition({
    serveUrl,
    id: compositionIdFor(spec.format),
    inputProps
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  await renderMedia({
    composition,
    serveUrl,
    outputLocation: outputPath,
    inputProps,
    codec: "h264",
    crf: 18,
    pixelFormat: "yuv420p",
    overwrite: true,
    logLevel: "error"
  });
}

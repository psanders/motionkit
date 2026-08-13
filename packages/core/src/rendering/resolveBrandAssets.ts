/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Resolves a brand's own on-disk assets (currently just the logo) into a
 * form `Timeline.tsx` can render directly, independent of where those
 * assets live on disk. The logo's `asset` path resolves relative to the
 * brand file's own directory (`brandDir`), not the spec's directory (see
 * design.md decision #3) — and `brandDir` isn't necessarily inside the
 * Remotion bundle's public directory, which `render.ts` always scopes to
 * the *spec's* directory (so scene assets, resolved relative to the spec,
 * can use Remotion's `staticFile()`). Reading the logo into a base64 data
 * URI up front sidesteps that mismatch entirely: no additional static
 * serving setup needed, and it works identically whether the resolved
 * brand came from the spec's own `brands/` directory or the package's
 * built-in one.
 */
import fs from "node:fs";
import path from "node:path";
import type { Brand } from "../brand/types.js";

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp"
};

function toDataUri(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES_BY_EXTENSION[extension] ?? "application/octet-stream";
  const base64 = fs.readFileSync(filePath).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Returns a copy of `brand` whose `logo.asset` is a self-contained data URI
 * read from `brandDir` — safe to pass straight into a Remotion `<Img>`
 * regardless of which directory the brand (and thus its logo) actually
 * lives in.
 */
export function resolveBrandAssets(brand: Brand, brandDir: string): Brand {
  const logoPath = path.resolve(brandDir, brand.logo.asset);

  return {
    ...brand,
    logo: { ...brand.logo, asset: toDataUri(logoPath) }
  };
}

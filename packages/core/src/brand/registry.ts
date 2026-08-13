/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Resolves a brand id to its parsed, validated Brand document. Mirrors
 * `foundation`'s asset-resolution pattern (resolved relative to the spec's
 * directory, not `cwd`) and its `validate()`/`render()` split: `findBrand`
 * never throws (used by `validate()` to report `BRAND_NOT_FOUND` with
 * suggestions), `loadBrand` throws (used by `render()`, which only runs
 * after `validate()` has already confirmed the brand resolves). See
 * design.md decision #1.
 */
import fs from "node:fs";
import path from "node:path";
import { brandSchema } from "./schema.js";
import type { Brand } from "./types.js";

/** The package's shipped built-in brands — ships with exactly `default.brand.json`. */
const BUILT_IN_BRANDS_DIR = path.join(import.meta.dirname, "brands");

const BRAND_FILE_SUFFIX = ".brand.json";

function brandsDirFor(specDir: string): string {
  return path.join(specDir, "brands");
}

/** Reads and parses a brand file if it exists and is well-formed; returns `null` (never throws) otherwise. */
function tryReadBrand(dir: string, id: string): { brand: Brand; brandDir: string } | null {
  const filePath = path.join(dir, `${id}${BRAND_FILE_SUFFIX}`);
  if (!fs.existsSync(filePath)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }

  const parsed = brandSchema.safeParse(raw);
  if (!parsed.success) return null;

  return { brand: parsed.data, brandDir: dir };
}

/** Lists the brand ids (`<id>.brand.json` file stems) available in a directory, or an empty array if it doesn't exist. */
function listBrandIds(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(BRAND_FILE_SUFFIX))
    .map((entry) => entry.name.slice(0, -BRAND_FILE_SUFFIX.length));
}

export type FindBrandResult =
  { found: true; brand: Brand; brandDir: string } | { found: false; availableIds: string[] };

/**
 * Resolves a brand id, checking `<specDir>/brands/<id>.brand.json` first,
 * then the package's built-in `brands/` directory. Non-throwing — an
 * unresolved id is reported (with the ids available from both locations),
 * not raised, so `validate()` can turn it into a structured error.
 */
export function findBrand(id: string, specDir: string): FindBrandResult {
  const fromSpecDir = tryReadBrand(brandsDirFor(specDir), id);
  if (fromSpecDir) return { found: true, ...fromSpecDir };

  const fromBuiltIn = tryReadBrand(BUILT_IN_BRANDS_DIR, id);
  if (fromBuiltIn) return { found: true, ...fromBuiltIn };

  const availableIds = Array.from(
    new Set([...listBrandIds(brandsDirFor(specDir)), ...listBrandIds(BUILT_IN_BRANDS_DIR)])
  ).sort();

  return { found: false, availableIds };
}

/** Throwing wrapper over `findBrand`, for `render()` to use once `validate()` has already confirmed the brand resolves. */
export function loadBrand(id: string, specDir: string): { brand: Brand; brandDir: string } {
  const result = findBrand(id, specDir);

  if (!result.found) {
    throw new Error(
      `Unknown brand "${id}". Available brands: ${result.availableIds.join(", ") || "(none)"}`
    );
  }

  return { brand: result.brand, brandDir: result.brandDir };
}

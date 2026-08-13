/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Validates a Video Specification structurally and semantically, and
 * reports every violation as a `StructuredError` instead of throwing.
 * Structural checks (Zod `safeParse`) run first and short-circuit the
 * result; semantic checks that require I/O (asset existence on disk) run
 * only once the document is structurally sound, and every semantic
 * violation is collected before returning.
 */
import fs from "node:fs";
import path from "node:path";
import type { core } from "zod/v4";
import { findBrand } from "../brand/registry.js";
import { placementSchema } from "../brand/schema.js";
import { videoSpecSchema } from "../video-spec/schema.js";
import type { VideoSpec } from "../video-spec/types.js";
import type { StructuredError, ValidationResult } from "./errors.js";

const SUPPORTED_FORMATS = ["16:9", "9:16"] as const;
const SUPPORTED_TRANSITIONS = ["fade", "slide-left", "slide-right", "zoom"] as const;
const SUPPORTED_FRAMES = ["browser"] as const;
const SUPPORTED_PLACEMENTS = placementSchema.options;

/**
 * Validates an unknown value as a Video Specification.
 *
 * @param spec - The candidate document, typically parsed from a spec JSON file
 * @param specDir - The directory the spec file lives in; asset paths are resolved against it (not `cwd`), so specs stay portable
 */
export function validate(spec: unknown, specDir: string): ValidationResult {
  const parsed = videoSpecSchema.safeParse(spec);

  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => toStructuredError(issue, spec))
    };
  }

  const errors = collectSemanticErrors(parsed.data, specDir);

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/** Zod issue codes that mean "a value was present but not one of the allowed values" (as opposed to missing/wrong type). */
const INVALID_VALUE_ISSUE_CODES = new Set(["invalid_value", "invalid_union"]);

/** Reads a nested value out of an untrusted candidate document, without throwing on non-objects. */
function getAtPath(candidate: unknown, pathSegments: readonly PropertyKey[]): unknown {
  let current = candidate;

  for (const segment of pathSegments) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<PropertyKey, unknown>)[segment];
  }

  return current;
}

/** Maps a structural Zod issue to a `StructuredError`, using the most specific applicable code. */
function toStructuredError(issue: core.$ZodIssue, rawSpec: unknown): StructuredError {
  const issuePath = issue.path.join(".");
  // A field the caller actually supplied a (wrong) value for, vs. one that
  // was omitted entirely — zod reports both as the same "invalid_value"
  // issue for enums, so we distinguish by checking the raw input directly.
  const isInvalidValue =
    INVALID_VALUE_ISSUE_CODES.has(issue.code ?? "") && getAtPath(rawSpec, issue.path) !== undefined;

  if (issuePath === "format" && isInvalidValue) {
    return {
      code: "UNSUPPORTED_FORMAT",
      message: `Format must be one of: ${SUPPORTED_FORMATS.join(", ")}`,
      path: issuePath
    };
  }

  if (issuePath.endsWith("transition.type") && isInvalidValue) {
    return {
      code: "UNSUPPORTED_TRANSITION",
      message: `Transition type must be one of: ${SUPPORTED_TRANSITIONS.join(", ")}`,
      path: issuePath
    };
  }

  if (issuePath.endsWith("frame") && isInvalidValue) {
    return {
      code: "UNSUPPORTED_FRAME",
      message: `Frame must be one of: ${SUPPORTED_FRAMES.join(", ")}`,
      path: issuePath
    };
  }

  if (issuePath.endsWith("logo") && isInvalidValue && isLogoPositionIssue(issue)) {
    return {
      code: "UNSUPPORTED_LOGO_POSITION",
      message: `Logo position must be one of: ${SUPPORTED_PLACEMENTS.join(", ")}`,
      path: `${issuePath}.position`
    };
  }

  return { code: "MALFORMED_SPEC", message: issue.message, path: issuePath || undefined };
}

/**
 * `logo` is a union of `z.literal(true)` and `{ position: placementSchema }`,
 * so an invalid `logo.position` surfaces as a Zod `invalid_union` issue at
 * the `logo` path itself, with the actual `position` violation nested in one
 * of the union's per-branch sub-issues. Distinguishes that case from an
 * altogether wrong `logo` shape (e.g. a string), which should fall through
 * to the generic `MALFORMED_SPEC` mapping instead.
 */
function isLogoPositionIssue(issue: core.$ZodIssue): boolean {
  if (issue.code !== "invalid_union") return false;

  const subIssues = (issue as unknown as { errors: core.$ZodIssue[][] }).errors ?? [];
  return subIssues.flat().some((subIssue) => subIssue.path.join(".") === "position");
}

/** Runs semantic checks (brand resolution, positive duration, asset existence, non-empty captions) against a structurally valid spec. */
function collectSemanticErrors(spec: VideoSpec, specDir: string): StructuredError[] {
  const errors: StructuredError[] = [];

  const brandResult = findBrand(spec.brand, specDir);
  if (!brandResult.found) {
    errors.push({
      code: "BRAND_NOT_FOUND",
      message: `Unknown brand: ${spec.brand}`,
      path: "brand",
      ...(brandResult.availableIds.length > 0 ? { suggestions: brandResult.availableIds } : {})
    });
  }

  spec.scenes.forEach((scene, index) => {
    const scenePath = `scenes.${index}`;

    if (scene.duration <= 0) {
      errors.push({
        code: "INVALID_DURATION",
        message: `Scene ${index} has a non-positive duration (${scene.duration}); duration must be greater than zero.`,
        path: `${scenePath}.duration`
      });
    }

    const assetError = checkAssetExists(scene.asset, specDir, scenePath);
    if (assetError) {
      errors.push(assetError);
    }

    if (scene.caption !== undefined && scene.caption.trim().length === 0) {
      errors.push({
        code: "EMPTY_CAPTION",
        message: `Scene ${index} declares an empty caption; caption text must be non-empty.`,
        path: `${scenePath}.caption`
      });
    }
  });

  return errors;
}

/** Checks that a scene's asset resolves to a file on disk, suggesting sibling files when it doesn't. */
function checkAssetExists(
  assetPath: string,
  specDir: string,
  scenePath: string
): StructuredError | null {
  const resolvedPath = path.resolve(specDir, assetPath);

  if (fs.existsSync(resolvedPath)) {
    return null;
  }

  const parentDir = path.dirname(resolvedPath);
  const suggestions = fs.existsSync(parentDir)
    ? fs
        .readdirSync(parentDir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
    : [];

  return {
    code: "ASSET_NOT_FOUND",
    message: `Asset not found: ${assetPath}`,
    path: `${scenePath}.asset`,
    ...(suggestions.length > 0 ? { suggestions } : {})
  };
}

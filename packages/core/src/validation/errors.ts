/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Structured error types returned by `validate()`. Deliberately not
 * exceptions — a validation caller (often an AI agent) needs a full,
 * machine-actionable report of every rule violation, not a single thrown
 * error. See design.md decision #2 in the `foundation` OpenSpec change.
 */

/** The fixed set of machine-readable codes `validate()` can report. */
export type StructuredErrorCode =
  | "MALFORMED_SPEC"
  | "ASSET_NOT_FOUND"
  | "INVALID_DURATION"
  | "UNSUPPORTED_FORMAT"
  | "UNSUPPORTED_TRANSITION"
  | "BRAND_NOT_FOUND"
  | "EMPTY_CAPTION"
  | "UNSUPPORTED_FRAME"
  | "UNSUPPORTED_LOGO_POSITION"
  | "UNSUPPORTED_MOTION_TYPE"
  | "MOTION_DIRECTION_MISMATCH"
  | "FOCAL_POINT_OUT_OF_BOUNDS"
  | "OVERLAY_SCENE_INDEX_OUT_OF_RANGE"
  | "UNSUPPORTED_OVERLAY_POSITION";

/** One rule violation, with an optional path into the document and optional correction hints. */
export interface StructuredError {
  code: StructuredErrorCode;
  message: string;
  path?: string;
  suggestions?: string[];
}

/** The outcome of validating a Video Specification. Never thrown — always returned. */
export type ValidationResult = { valid: true } | { valid: false; errors: StructuredError[] };

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * `validate_video` tool logic. A plain function independent of the MCP SDK
 * so it's directly unit-testable (mirrors `ping.ts`'s separation) — all real
 * validation is delegated entirely to `@motionkit/core`'s own `validate()`,
 * the single source of truth for structural and semantic spec rules.
 */
import { validate, type ValidationResult } from "@motionkit/core";
import { assertResolvableSpecDir } from "./specDir.js";

export interface ValidateVideoInput {
  spec: unknown;
  specDir: string;
}

/**
 * Validates a Video Specification document against `specDir`, returning
 * `@motionkit/core`'s `ValidationResult` directly. An invalid specification
 * is a normal, successful return (not a thrown error) — see design.md
 * decision #4. Only an unresolvable `specDir` throws.
 */
export async function validateVideo(input: ValidateVideoInput): Promise<ValidationResult> {
  assertResolvableSpecDir(input.specDir);
  return validate(input.spec, input.specDir);
}

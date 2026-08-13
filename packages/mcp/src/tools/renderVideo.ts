/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * `render_video` tool logic. A plain function independent of the MCP SDK
 * (mirrors `ping.ts`'s separation), following the exact validate-then-render
 * precedent `packages/cli/src/commands/render.ts` already establishes: run
 * `@motionkit/core`'s `validate()` first so an invalid spec is never passed
 * to `render()`, then parse with `videoSpecSchema` (guaranteed to succeed,
 * since `validate()` already confirmed the document is structurally and
 * semantically sound) to get the typed `VideoSpec` `render()` expects.
 */
import path from "node:path";
import {
  render,
  RenderValidationError,
  validate,
  videoSpecSchema,
  type StructuredError
} from "@motionkit/core";
import { assertResolvableSpecDir } from "./specDir.js";

export interface RenderVideoInput {
  spec: unknown;
  specDir: string;
  outputPath?: string;
}

/**
 * `render_video`'s result: a successful render's output path, or the same
 * structured-errors shape `validate_video` reports for an invalid spec —
 * giving both tools one consistent "is this spec valid" shape to branch on.
 */
export type RenderVideoResult =
  { outputPath: string } | { valid: false; errors: StructuredError[] };

const DEFAULT_OUTPUT_FILENAME = "output.mp4";

/**
 * Renders a Video Specification document to MP4, refusing (with the same
 * structured errors `validate_video` would report) if it fails validation.
 * `outputPath` defaults to `<specDir>/output.mp4` when omitted. An invalid
 * specification is a normal, successful return (not a thrown error) — see
 * design.md decision #4. Only an unresolvable `specDir` or an unexpected
 * `render()` failure (e.g. an `ffmpeg` error) throws.
 */
export async function renderVideo(input: RenderVideoInput): Promise<RenderVideoResult> {
  assertResolvableSpecDir(input.specDir);

  const outputPath = input.outputPath ?? path.join(input.specDir, DEFAULT_OUTPUT_FILENAME);

  const preflight = validate(input.spec, input.specDir);
  if (!preflight.valid) {
    return { valid: false, errors: preflight.errors };
  }

  // `validate()` above already confirmed `input.spec` is structurally and
  // semantically sound, so this parse is guaranteed to succeed — it only
  // exists to produce the typed `VideoSpec` `render()` expects.
  const spec = videoSpecSchema.parse(input.spec);

  try {
    await render(spec, input.specDir, outputPath);
  } catch (err) {
    if (err instanceof RenderValidationError) {
      return { valid: false, errors: err.errors };
    }
    throw err;
  }

  return { outputPath };
}

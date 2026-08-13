/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * `motionkit render <spec>` — reads a Video Specification JSON file and
 * renders it via `@motionkit/core`'s `render()`, reporting the output path
 * on success or the structured validation errors on failure. Validates
 * up front (via `validate()`, the same call `motionkit validate` makes, for
 * identical error reporting) so an invalid spec is never rendered.
 */
import fs from "node:fs";
import path from "node:path";
import { Args, Command, Flags } from "@oclif/core";
import { render, RenderValidationError, validate, videoSpecSchema } from "@motionkit/core";
import { formatStructuredErrors } from "../lib/printStructuredErrors.js";

/** Default output path when `--output` is omitted: alongside the spec file, same base name, `.mp4`. */
function defaultOutputPath(specPath: string): string {
  const { dir, name } = path.parse(specPath);
  return path.join(dir, `${name}.mp4`);
}

export default class Render extends Command {
  static override description = "Renders a Video Specification file to an MP4.";

  static override args = {
    spec: Args.string({
      description: "Path to the Video Specification JSON file",
      required: true
    })
  };

  static override flags = {
    output: Flags.string({
      char: "o",
      description: "Output MP4 path (defaults to the spec's file name, alongside the spec file)"
    })
  };

  override async run(): Promise<void> {
    const { args, flags } = await this.parse(Render);
    const specPath = path.resolve(args.spec);
    const specDir = path.dirname(specPath);
    const outputPath = path.resolve(flags.output ?? defaultOutputPath(specPath));

    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(specPath, "utf-8"));
    } catch (err) {
      this.log(`Could not read or parse ${specPath}: ${(err as Error).message}`);
      this.exit(1);
    }

    const preflight = validate(raw, specDir);
    if (!preflight.valid) {
      this.log(`Invalid Video Specification: ${specPath}`);
      for (const line of formatStructuredErrors(preflight.errors)) {
        this.log(line);
      }
      this.exit(1);
    }

    // `validate()` above already confirmed `raw` is structurally and
    // semantically sound, so this parse is guaranteed to succeed — it only
    // exists to produce the typed `VideoSpec` `render()` expects.
    const spec = videoSpecSchema.parse(raw);

    try {
      await render(spec, specDir, outputPath);
    } catch (err) {
      if (err instanceof RenderValidationError) {
        this.log(`Invalid Video Specification: ${specPath}`);
        for (const line of formatStructuredErrors(err.errors)) {
          this.log(line);
        }
        this.exit(1);
      }
      throw err;
    }

    this.log(`Rendered: ${outputPath}`);
  }
}

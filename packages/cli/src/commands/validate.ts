/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * `motionkit validate <spec>` — reads a Video Specification JSON file, runs
 * `@motionkit/core`'s `validate()`, and reports the result via console
 * output and exit code so it can be scripted.
 */
import fs from "node:fs";
import path from "node:path";
import { Args, Command } from "@oclif/core";
import { validate } from "@motionkit/core";
import { formatStructuredErrors } from "../lib/printStructuredErrors.js";

export default class Validate extends Command {
  static override description =
    "Validates a Video Specification file and reports structured errors.";

  static override args = {
    spec: Args.string({
      description: "Path to the Video Specification JSON file",
      required: true
    })
  };

  override async run(): Promise<void> {
    const { args } = await this.parse(Validate);
    const specPath = path.resolve(args.spec);
    const specDir = path.dirname(specPath);

    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(specPath, "utf-8"));
    } catch (err) {
      this.log(`Could not read or parse ${specPath}: ${(err as Error).message}`);
      this.exit(1);
    }

    const result = validate(raw, specDir);

    if (result.valid) {
      this.log(`Valid Video Specification: ${specPath}`);
      return;
    }

    this.log(`Invalid Video Specification: ${specPath}`);
    for (const line of formatStructuredErrors(result.errors)) {
      this.log(line);
    }

    this.exit(1);
  }
}

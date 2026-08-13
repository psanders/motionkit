/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 */
import { Command } from "@oclif/core";
import { getPingPayload } from "../lib/ping.js";

export default class Ping extends Command {
  static override description =
    "Health check — confirms the MotionKit CLI wires up to @motionkit/core.";

  override async run(): Promise<void> {
    this.log(JSON.stringify(getPingPayload()));
  }
}

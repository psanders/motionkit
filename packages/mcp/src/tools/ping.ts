/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * The `ping` tool proves the MCP transport is wired up end to end. Real
 * tools (`create_video`, `add_a_roll`, ...) land later via OpenSpec changes.
 */
import { getHealthStatus, type HealthStatus } from "@motionkit/core";

export function ping(): HealthStatus {
  return getHealthStatus();
}

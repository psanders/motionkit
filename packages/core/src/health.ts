/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * A trivial, side-effect-free health check that both `@motionkit/mcp` and
 * `@motionkit/cli` call into, so the `ping` tool/command prove they wire up
 * to `@motionkit/core` rather than returning a fully static payload.
 */
export const VERSION = "0.1.0";

export interface HealthStatus {
  ok: true;
  version: string;
}

export function getHealthStatus(): HealthStatus {
  return { ok: true, version: VERSION };
}

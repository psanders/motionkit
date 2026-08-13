/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Pure payload builder behind the `motionkit ping` command, kept separate
 * from the oclif `Command` class so it is trivially unit-testable.
 */
import { getHealthStatus, type HealthStatus } from "@motionkit/core";

export function getPingPayload(): HealthStatus {
  return getHealthStatus();
}

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Shared `specDir` resolvability check for `validateVideo`/`renderVideo`.
 * Unlike the CLI (which derives `specDir` from the spec file's own
 * location), an MCP tool call receives `specDir` as a bare caller-supplied
 * path with nothing to validate it against up front. `@motionkit/core`'s
 * `validate()`/`render()` treat a missing `specDir` as "no assets/brands
 * found there" (structured validation errors, not exceptions), which would
 * make an unresolvable directory indistinguishable from a spec that simply
 * references a missing asset. This check exists so that distinction stays
 * a genuine execution failure (`isError: true`, per design.md decision #4),
 * not a normal validation result.
 */
import fs from "node:fs";

/** Throws a readable `Error` if `specDir` doesn't exist or isn't a directory. */
export function assertResolvableSpecDir(specDir: string): void {
  let stats: fs.Stats;

  try {
    stats = fs.statSync(specDir);
  } catch (err) {
    throw new Error(`Cannot resolve specDir "${specDir}": ${(err as Error).message}`);
  }

  if (!stats.isDirectory()) {
    throw new Error(`specDir "${specDir}" is not a directory`);
  }
}

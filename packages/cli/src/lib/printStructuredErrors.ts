/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Shared console formatting for `@motionkit/core`'s `StructuredError[]`,
 * used by both the `validate` and `render` commands so their failure output
 * is identical.
 */
import type { StructuredError } from "@motionkit/core";

export function formatStructuredErrors(errors: StructuredError[]): string[] {
  return errors.flatMap((error) => {
    const location = error.path ? `${error.path}: ` : "";
    const lines = [`  [${error.code}] ${location}${error.message}`];
    if (error.suggestions && error.suggestions.length > 0) {
      lines.push(`      did you mean: ${error.suggestions.join(", ")}`);
    }
    return lines;
  });
}

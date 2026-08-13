/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * A minimal harness for exercising oclif commands in tests without
 * `@oclif/test`: runs the command's static `run()` lifecycle against this
 * package's own config, captures everything passed to `this.log(...)`, and
 * turns the `ExitError` oclif throws internally for `this.exit(code)` back
 * into a plain exit code instead of letting it escape as a test failure.
 */
import path from "node:path";
import sinon from "sinon";
import type { Command, Config } from "@oclif/core";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "../..");

export interface CliResult {
  exitCode: number;
  output: string;
}

interface RunnableCommand {
  run(argv: string[], opts?: string | Partial<Config>): Promise<unknown>;
  prototype: Pick<Command, "log">;
}

/** Runs an oclif command class, returning its exit code and everything it logged. */
export async function runCliCommand(
  CommandClass: RunnableCommand,
  argv: string[]
): Promise<CliResult> {
  const lines: string[] = [];
  const logStub = sinon.stub(CommandClass.prototype, "log").callsFake((message?: string) => {
    if (message !== undefined) lines.push(message);
  });

  try {
    await CommandClass.run(argv, PACKAGE_ROOT);
    return { exitCode: 0, output: lines.join("\n") };
  } catch (err) {
    const exit = (err as { oclif?: { exit?: number } }).oclif?.exit;
    if (typeof exit === "number") {
      return { exitCode: exit, output: lines.join("\n") };
    }
    throw err;
  } finally {
    logStub.restore();
  }
}

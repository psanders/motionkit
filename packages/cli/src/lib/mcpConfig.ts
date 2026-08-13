/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Pure helpers behind `motionkit config` — resolving an MCP client's config
 * file path, locating the built `@motionkit/mcp` server entry point
 * relative to this package, and merging MotionKit's `mcpServers` entry into
 * whatever's already in that file without touching any other entry. Kept
 * separate from the oclif `Command` class for the same reason
 * `src/lib/ping.ts` is: trivially unit-testable without a real filesystem
 * path or a real client installed.
 */
import os from "node:os";
import path from "node:path";

/**
 * MCP clients `motionkit config` knows how to write to. Only `"claude"`
 * (Claude Desktop) exists this phase — the shape leaves room for more
 * clients later without a breaking CLI change.
 */
export const SUPPORTED_CLIENTS = ["claude"] as const;
export type McpClient = (typeof SUPPORTED_CLIENTS)[number];

/** The `mcpServers.<name>` entry shape both Claude Desktop and Claude Code's `.mcp.json` use. */
export interface McpServerEntry {
  command: string;
  args: string[];
}

function resolveClaudeDesktopConfigPath(platform: NodeJS.Platform, home: string): string {
  switch (platform) {
    case "darwin":
      return path.join(
        home,
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json"
      );
    case "win32":
      return path.join(
        process.env.APPDATA ?? path.join(home, "AppData", "Roaming"),
        "Claude",
        "claude_desktop_config.json"
      );
    default:
      return path.join(home, ".config", "Claude", "claude_desktop_config.json");
  }
}

/** Resolves the target config file path for a client on the current (or an injected) platform/home dir. */
export function resolveConfigPath(
  client: McpClient,
  opts: { platform?: NodeJS.Platform; home?: string } = {}
): string {
  const platform = opts.platform ?? process.platform;
  const home = opts.home ?? os.homedir();

  switch (client) {
    case "claude":
      return resolveClaudeDesktopConfigPath(platform, home);
  }
}

/**
 * Locates the built `@motionkit/mcp` server entry point as a sibling
 * package of `@motionkit/cli`. `fromCompiledDir` is expected to be
 * `import.meta.dirname` from inside this package's own compiled
 * `dist/commands/*.js` — three levels up from there lands on `packages/`,
 * where `packages/mcp` sits alongside `packages/cli`.
 */
export function resolveMcpServerEntryPath(fromCompiledDir: string): string {
  return path.resolve(fromCompiledDir, "../../../mcp/dist/index.js");
}

/** Builds the `mcpServers` entry MotionKit registers itself as: launch its built MCP server over stdio via `node`. */
export function buildMotionkitServerEntry(mcpEntryPath: string): McpServerEntry {
  return { command: "node", args: [mcpEntryPath] };
}

/**
 * Merges MotionKit's `mcpServers.motionkit` entry into an existing config
 * file's raw contents (or a fresh document, if `existingRaw` is
 * `undefined`), preserving every other top-level key and every other
 * registered server untouched. Throws if `existingRaw` is present but not
 * valid JSON — the caller reports that rather than silently overwriting a
 * file it can't parse.
 */
export function mergeMcpServerConfig(
  existingRaw: string | undefined,
  entry: McpServerEntry
): string {
  const existing: Record<string, unknown> = existingRaw ? JSON.parse(existingRaw) : {};
  const existingServers =
    typeof existing.mcpServers === "object" && existing.mcpServers !== null
      ? (existing.mcpServers as Record<string, unknown>)
      : {};

  const merged = {
    ...existing,
    mcpServers: {
      ...existingServers,
      motionkit: entry
    }
  };

  return `${JSON.stringify(merged, null, 2)}\n`;
}

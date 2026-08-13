/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * `motionkit config` — registers the built MotionKit MCP server
 * (`@motionkit/mcp`) with an MCP-aware client's config file, so the client
 * can launch it without the user hand-editing JSON. Defaults to `--client
 * claude` (Claude Desktop), the only client this phase supports — the flag
 * exists so more clients can be added later without a breaking CLI change.
 */
import fs from "node:fs";
import path from "node:path";
import { Command, Flags } from "@oclif/core";
import {
  buildMotionkitServerEntry,
  mergeMcpServerConfig,
  resolveConfigPath,
  resolveMcpServerEntryPath,
  SUPPORTED_CLIENTS,
  type McpClient
} from "../lib/mcpConfig.js";

function isSupportedClient(value: string): value is McpClient {
  return (SUPPORTED_CLIENTS as readonly string[]).includes(value);
}

export default class Config extends Command {
  static override description =
    "Registers the MotionKit MCP server with an MCP-aware client's config file.";

  static override flags = {
    client: Flags.string({
      description: `The MCP client to configure. Supported: ${SUPPORTED_CLIENTS.join(", ")}.`,
      default: "claude"
    }),
    path: Flags.string({
      description:
        "Overrides the client config file path MotionKit would otherwise resolve for --client."
    })
  };

  override async run(): Promise<void> {
    const { flags } = await this.parse(Config);

    if (!isSupportedClient(flags.client)) {
      this.log(
        `Unsupported client: "${flags.client}". Supported clients: ${SUPPORTED_CLIENTS.join(", ")}.`
      );
      this.exit(1);
      return;
    }

    const mcpEntryPath = resolveMcpServerEntryPath(import.meta.dirname);
    if (!fs.existsSync(mcpEntryPath)) {
      this.log(
        `Could not find the built MotionKit MCP server at ${mcpEntryPath} — run "npm run build" from the repo root first.`
      );
      this.exit(1);
      return;
    }

    const configPath = flags.path ? path.resolve(flags.path) : resolveConfigPath(flags.client);
    const existingRaw = fs.existsSync(configPath)
      ? fs.readFileSync(configPath, "utf-8")
      : undefined;

    let merged: string;
    try {
      merged = mergeMcpServerConfig(existingRaw, buildMotionkitServerEntry(mcpEntryPath));
    } catch (err) {
      this.log(`Could not parse existing config at ${configPath}: ${(err as Error).message}`);
      this.exit(1);
      return;
    }

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, merged);

    this.log(`Registered the MotionKit MCP server with "${flags.client}" at ${configPath}`);
    this.log("Restart the client for the change to take effect.");
  }
}

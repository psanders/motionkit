/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 */
import { expect } from "chai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import McpConfig from "../src/commands/mcp-config.js";
import {
  buildMotionkitServerEntry,
  mergeMcpServerConfig,
  resolveConfigPath
} from "../src/lib/mcpConfig.js";
import { runCliCommand } from "./support/runCliCommand.js";

describe("mcpConfig helpers", () => {
  it("should resolve Claude Desktop's config path per platform", () => {
    // Act / Assert
    expect(resolveConfigPath("claude", { platform: "darwin", home: "/Users/pat" })).to.equal(
      "/Users/pat/Library/Application Support/Claude/claude_desktop_config.json"
    );
    expect(resolveConfigPath("claude", { platform: "linux", home: "/home/pat" })).to.equal(
      "/home/pat/.config/Claude/claude_desktop_config.json"
    );
  });

  it("should build a node-launched mcpServers entry for the given mcp entry path", () => {
    // Act
    const entry = buildMotionkitServerEntry("/repo/packages/mcp/dist/index.js");

    // Assert
    expect(entry).to.deep.equal({ command: "node", args: ["/repo/packages/mcp/dist/index.js"] });
  });

  it("should create a fresh mcpServers document when no config exists yet", () => {
    // Act
    const merged = mergeMcpServerConfig(undefined, { command: "node", args: ["entry.js"] });

    // Assert
    expect(JSON.parse(merged)).to.deep.equal({
      mcpServers: { motionkit: { command: "node", args: ["entry.js"] } }
    });
  });

  it("should merge into an existing config without disturbing other keys or servers", () => {
    // Arrange
    const existing = JSON.stringify({
      someOtherTopLevelKey: true,
      mcpServers: { otherServer: { command: "python", args: ["other.py"] } }
    });

    // Act
    const merged = mergeMcpServerConfig(existing, { command: "node", args: ["entry.js"] });

    // Assert
    expect(JSON.parse(merged)).to.deep.equal({
      someOtherTopLevelKey: true,
      mcpServers: {
        otherServer: { command: "python", args: ["other.py"] },
        motionkit: { command: "node", args: ["entry.js"] }
      }
    });
  });

  it("should throw on an existing config that isn't valid JSON", () => {
    // Act / Assert
    expect(() => mergeMcpServerConfig("not json", { command: "node", args: [] })).to.throw();
  });
});

describe("motionkit mcp-config", () => {
  let workDir: string;
  let configPath: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "motionkit-cli-mcp-config-"));
    configPath = path.join(workDir, "nested", "claude_desktop_config.json");
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it("should write the motionkit mcpServers entry to --path and exit 0", async () => {
    // Act
    const result = await runCliCommand(McpConfig, ["--path", configPath]);

    // Assert
    expect(result.exitCode).to.equal(0);
    expect(fs.existsSync(configPath)).to.equal(true);
    const written = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(written.mcpServers.motionkit.command).to.equal("node");
    expect(written.mcpServers.motionkit.args[0]).to.match(/mcp[/\\]dist[/\\]index\.js$/);
  });

  it("should preserve an existing config's other content at --path", async () => {
    // Arrange
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
      configPath,
      JSON.stringify({ mcpServers: { otherServer: { command: "python", args: [] } } })
    );

    // Act
    const result = await runCliCommand(McpConfig, ["--path", configPath]);

    // Assert
    expect(result.exitCode).to.equal(0);
    const written = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(written.mcpServers.otherServer).to.deep.equal({ command: "python", args: [] });
    expect(written.mcpServers.motionkit.command).to.equal("node");
  });

  it("should reject an unsupported --client and exit non-zero", async () => {
    // Act
    const result = await runCliCommand(McpConfig, ["--client", "cursor", "--path", configPath]);

    // Assert
    expect(result.exitCode).to.not.equal(0);
    expect(result.output).to.include("Unsupported client");
    expect(fs.existsSync(configPath)).to.equal(false);
  });
});

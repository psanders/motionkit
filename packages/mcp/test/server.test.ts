/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Server-level test: connects a real MCP `Client` to `createServer()`'s
 * `McpServer` over the SDK's in-memory transport, confirming `ping`,
 * `validate_video`, and `render_video` are registered and reachable end to
 * end through the actual protocol layer (not just as plain functions).
 */
import { expect } from "chai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/index.js";
import { generateFixtureVideo } from "./support/generateFixture.js";

interface ToolTextContent {
  type: "text";
  text: string;
}

function firstText(result: { content: unknown; isError?: boolean }): string {
  const [content] = result.content as ToolTextContent[];
  return content.text;
}

describe("MotionKit MCP server", function () {
  this.timeout(120_000);

  let client: Client;
  let specDir: string;

  beforeEach(async () => {
    specDir = fs.mkdtempSync(path.join(os.tmpdir(), "motionkit-mcp-server-"));
    generateFixtureVideo(path.join(specDir, "clip.mp4"));

    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({ name: "test-client", version: "0.1.0" });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  });

  afterEach(async () => {
    await client.close();
    fs.rmSync(specDir, { recursive: true, force: true });
  });

  it("should list ping, validate_video, and render_video", async () => {
    // Act
    const { tools } = await client.listTools();

    // Assert
    const toolNames = tools.map((tool) => tool.name);
    expect(toolNames).to.include.members(["ping", "validate_video", "render_video"]);
  });

  it("should call validate_video and report a valid specification as valid", async () => {
    // Arrange
    const spec = {
      version: "1",
      format: "16:9",
      fps: 30,
      scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 1 }]
    };

    // Act
    const result = await client.callTool({ name: "validate_video", arguments: { spec, specDir } });

    // Assert
    expect(result.isError).to.not.equal(true);
    expect(JSON.parse(firstText(result))).to.deep.equal({ valid: true });
  });

  it("should call validate_video and report structured errors for an invalid specification, not as a tool error", async () => {
    // Arrange
    const spec = {
      version: "1",
      format: "16:9",
      fps: 30,
      scenes: [{ type: "a_roll", asset: "missing.mp4", duration: 1 }]
    };

    // Act
    const result = await client.callTool({ name: "validate_video", arguments: { spec, specDir } });

    // Assert — an invalid spec is a normal result, not isError: true
    expect(result.isError).to.not.equal(true);
    const parsed = JSON.parse(firstText(result));
    expect(parsed.valid).to.equal(false);
    expect(parsed.errors.some((e: { code: string }) => e.code === "ASSET_NOT_FOUND")).to.equal(
      true
    );
  });

  it("should call render_video and render a valid specification to the default output path", async () => {
    // Arrange
    const spec = {
      version: "1",
      format: "16:9",
      fps: 10,
      scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 1 }]
    };

    // Act
    const result = await client.callTool({ name: "render_video", arguments: { spec, specDir } });

    // Assert
    expect(result.isError).to.not.equal(true);
    const expectedOutputPath = path.join(specDir, "output.mp4");
    expect(JSON.parse(firstText(result))).to.deep.equal({ outputPath: expectedOutputPath });
    expect(fs.existsSync(expectedOutputPath)).to.equal(true);
  });

  it("should report isError: true when specDir cannot be resolved", async () => {
    // Arrange
    const spec = {
      version: "1",
      format: "16:9",
      fps: 30,
      scenes: [{ type: "a_roll", asset: "clip.mp4", duration: 1 }]
    };
    const missingDir = path.join(specDir, "does-not-exist");

    // Act
    const result = await client.callTool({
      name: "validate_video",
      arguments: { spec, specDir: missingDir }
    });

    // Assert
    expect(result.isError).to.equal(true);
  });

  it("should still serve ping alongside the new tools", async () => {
    // Act
    const result = await client.callTool({ name: "ping", arguments: {} });

    // Assert
    expect(JSON.parse(firstText(result))).to.deep.equal({ ok: true, version: "0.1.0" });
  });
});

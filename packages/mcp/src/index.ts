/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * MotionKit MCP server. Boots over stdio and exposes a minimal `ping` tool
 * to prove the transport wires up. Real tools come later via OpenSpec changes.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ping } from "./tools/ping.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "motionkit",
    version: "0.1.0"
  });

  server.registerTool(
    "ping",
    {
      title: "Ping",
      description: "Health check — confirms the MotionKit MCP server is reachable.",
      inputSchema: {}
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(ping()) }]
    })
  );

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * MotionKit MCP server. Boots over stdio and exposes `ping` (a health check)
 * alongside `validate_video`/`render_video`, the stateless, whole-spec-in/
 * whole-result-out wrappers around `@motionkit/core`'s `validate()`/
 * `render()`. Each tool's real logic lives in `./tools/` as a plain function
 * independent of the SDK (see `./tools/ping.ts`); this file only wires those
 * functions into `McpServer.registerTool` and formats their result/error
 * shape for the protocol.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ping } from "./tools/ping.js";
import { renderVideo } from "./tools/renderVideo.js";
import { validateVideo } from "./tools/validateVideo.js";

type ToolTextResult = { content: [{ type: "text"; text: string }]; isError?: true };

/** Wraps a tool's JSON-serializable result as MCP text content. */
function toTextResult(value: unknown): ToolTextResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

/**
 * Reports a thrown error as `isError: true` (see design.md decision #4):
 * reserved for genuine execution failures — an unresolvable `specDir`, an
 * unexpected `render()` exception — distinct from a structured validation
 * failure, which is always a normal (non-`isError`) result.
 */
function toErrorResult(err: unknown): ToolTextResult {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: message }], isError: true };
}

const specInputShape = {
  spec: z.unknown().describe("The Video Specification document, as a JSON value."),
  specDir: z
    .string()
    .describe(
      "Absolute path to the directory the spec's scene/overlay asset paths and brand id resolve against."
    )
};

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

  server.registerTool(
    "validate_video",
    {
      title: "Validate Video Specification",
      description:
        "Validates a Video Specification document against MotionKit's structural and semantic rules, without rendering. Returns { valid: true } or { valid: false, errors: [...] } listing every violation. Use this to check or iterate on a spec before calling render_video.",
      inputSchema: specInputShape
    },
    async ({ spec, specDir }) => {
      try {
        return toTextResult(await validateVideo({ spec, specDir }));
      } catch (err) {
        return toErrorResult(err);
      }
    }
  );

  server.registerTool(
    "render_video",
    {
      title: "Render Video",
      description:
        "Renders a Video Specification document to an MP4 via MotionKit's Remotion pipeline, validating first and refusing to render an invalid spec (reporting the same structured errors validate_video would, rather than a partial or corrupt output). Returns { outputPath } on success. outputPath defaults to <specDir>/output.mp4 when omitted.",
      inputSchema: {
        ...specInputShape,
        outputPath: z
          .string()
          .optional()
          .describe(
            "Absolute path to write the rendered MP4 to. Defaults to <specDir>/output.mp4 when omitted."
          )
      }
    },
    async ({ spec, specDir, outputPath }) => {
      try {
        return toTextResult(await renderVideo({ spec, specDir, outputPath }));
      } catch (err) {
        return toErrorResult(err);
      }
    }
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

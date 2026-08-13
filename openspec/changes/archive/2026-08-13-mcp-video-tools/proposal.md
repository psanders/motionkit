## Why

`@motionkit/mcp`, the MCP server AI agents actually talk to, exposes exactly one
tool: `ping`, a health check. Every real capability MotionKit has — the Video
Specification schema, the brand system, validation, deterministic Remotion
rendering — has been built entirely in `@motionkit/core` and is only reachable
today via `@motionkit/cli`'s `validate`/`render` commands. An MCP client (an AI
agent, or a video-generation tool suite looking to drive MotionKit) currently has
no way to build or render a video through the protocol MotionKit exists to serve.
This closes that gap by exposing the same two operations the CLI already wraps,
over MCP.

## What Changes

- Add a `validate_video` tool: given a Video Specification document and a
  directory to resolve its assets/brand against, returns the same structured
  `ValidationResult` `@motionkit/core`'s `validate()` produces.
- Add a `render_video` tool: given the same inputs plus an output path, renders
  the specification to MP4 via `@motionkit/core`'s `render()`, refusing (with the
  same structured errors) if the specification is invalid — mirroring
  `motionkit render`'s validate-before-render behavior exactly.
- Both tools operate on a whole Video Specification passed in and reported back
  each call — no server-held session state, no new persistence layer. The calling
  agent holds and edits the spec between calls, consistent with `CLAUDE.md`'s
  "no database — spec state is either passed through the MCP session or handled
  by the calling agent."
- The `ping` tool stays as-is (still useful as a lightweight reachability check).

## Capabilities

### New Capabilities

- `mcp-video-tools`: the MCP tool surface for validating and rendering a Video
  Specification.

### Modified Capabilities

(none — `video-validation`/`video-rendering`'s own behavior is unchanged; this
change only exposes existing `@motionkit/core` behavior over a new transport)

## Impact

- `packages/mcp/src/index.ts` — register two new tools alongside `ping`.
- `packages/mcp/src/tools/` — new `validateVideo.ts`/`renderVideo.ts` (or
  equivalent), following the same separation `ping.ts` already establishes
  (a plain function wrapping `@motionkit/core`, kept independent of the MCP SDK
  plumbing so it's directly unit-testable).
- No changes to `@motionkit/core` or `@motionkit/cli` — this only exposes what
  already exists.
- Not a breaking change: `ping` is untouched, this is purely additive.

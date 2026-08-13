## 1. Tool logic

- [ ] 1.1 Add `packages/mcp/src/tools/validateVideo.ts`: `validateVideo({ spec, specDir })` wrapping `@motionkit/core`'s `validate()`, returning its `ValidationResult` directly
- [ ] 1.2 Add `packages/mcp/src/tools/renderVideo.ts`: `renderVideo({ spec, specDir, outputPath? })` wrapping `@motionkit/core`'s `render()`; default `outputPath` to `path.join(specDir, "output.mp4")` when omitted; catch `RenderValidationError` and return `{ valid: false, errors }`; return `{ outputPath }` on success; let any other thrown error propagate
- [ ] 1.3 Define the shared `RenderVideoResult` type (`{ outputPath: string } | { valid: false; errors: StructuredError[] }`) alongside `renderVideo.ts`

## 2. MCP wiring

- [ ] 2.1 In `packages/mcp/src/index.ts`, register `validate_video` via `server.registerTool`, with an `inputSchema` of `{ spec: <loosely-typed JSON value>, specDir: z.string() }`, JSON-serializing `validateVideo()`'s return value into the tool result's text content
- [ ] 2.2 Register `render_video` similarly, with `inputSchema` adding an optional `outputPath: z.string().optional()`, JSON-serializing `renderVideo()`'s return value
- [ ] 2.3 Wrap both handlers so a thrown error (unresolvable `specDir`, unexpected render failure) surfaces as `isError: true` with a readable message, distinct from a structured validation-failure result
- [ ] 2.4 Update the tool descriptions/titles to be genuinely useful to an agent choosing between `validate_video`, `render_video`, and `ping`

## 3. Tests

- [ ] 3.1 Unit tests for `validateVideo()`: valid spec, invalid spec (multiple violations reported), consistent with `@motionkit/core`'s own `validate()` test fixtures
- [ ] 3.2 Unit tests for `renderVideo()`: valid spec renders and returns `{ outputPath }`; invalid spec returns the structured-errors shape and writes no file; default `outputPath` is used when omitted; explicit `outputPath` is honored
- [ ] 3.3 A validation-failure-case test per `CLAUDE.md` convention: assert the structured error shape and that no side effect (no file written) occurred
- [ ] 3.4 Server-level test (via the SDK's in-memory transport, if available, or a direct call to `createServer()`'s registered handlers) confirming `validate_video`/`render_video` are registered and reachable end to end, alongside the existing `ping` test

## 4. Docs

- [ ] 4.1 Update `CLAUDE.md`'s `packages/mcp` description — no longer "one trivial `ping` tool"
- [ ] 4.2 Update the root `README.md`'s phase-status paragraph to reflect Phase 4 (MCP tool surface) as landed, not "next"
- [ ] 4.3 Document `validate_video`/`render_video`'s input/output shape somewhere discoverable (README or a `packages/mcp/README.md`) for whoever configures an MCP client against this server

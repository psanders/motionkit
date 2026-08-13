## Context

`packages/mcp/src/index.ts` registers one tool (`ping`) via
`server.registerTool(name, { title, description, inputSchema }, handler)` on the
SDK's `McpServer` (`@modelcontextprotocol/sdk@^1.30.0`). `packages/mcp/src/tools/`
holds one file per tool as a plain function independent of the SDK
(`ping.ts` → `ping(): HealthStatus`), which `index.ts` wires into the handler —
kept separate so the logic is directly unit-testable without a live MCP
transport. This change follows that same shape for two new tools.

`@motionkit/core` already fully implements what these tools need to expose:
`validate(spec: unknown, specDir: string): ValidationResult` (never throws) and
`render(spec: VideoSpec, specDir: string, outputPath: string): Promise<void>`
(throws `RenderValidationError` — carrying the same `StructuredError[]` shape —
if `spec` fails its own internal `validate()` call before rendering; throws
other errors for genuine render failures). `@motionkit/cli`'s `render`/`validate`
commands already wrap exactly these two calls, so this change has direct,
working precedent to mirror rather than a new contract to invent.

## Goals / Non-Goals

**Goals:**

- Expose `validate()` and `render()` over MCP with the same semantics the CLI
  already gives them (render validates first, refuses to run on an invalid spec).
- Keep both tools stateless — a whole spec in, a whole result out, no
  server-held session between calls.
- Keep tool logic unit-testable independent of the MCP transport, matching
  `ping.ts`'s existing separation.

**Non-Goals:**

- No session/state management, no incremental spec-building tools
  (`add_a_roll`, etc.) — deferred; monolithic whole-spec tools were chosen
  specifically to avoid needing this now.
- No changes to `@motionkit/core` or `@motionkit/cli` — this only adds a new
  transport onto existing, unchanged behavior.
- No new brand- or asset-discovery tools (e.g. "list available brands") — out
  of scope; the calling agent is assumed to already know or be told the
  `specDir` it's working against.

## Decisions

**1. Tool input: `spec` stays loosely typed (`unknown`/a plain JSON object), not
`videoSpecSchema`'s own shape, in the MCP `inputSchema`.**

`videoSpecSchema` (`packages/core/src/video-spec/schema.ts`) carries a
document-level `.check()` refinement (e.g. "the first scene may not declare a
transition") beyond its raw field shape. The SDK's `registerTool` `inputSchema`
takes a `ZodRawShape` it uses to construct its own request schema — passing only
`videoSpecSchema`'s shape would silently drop that refinement, giving a false
sense of MCP-level validation while actually validating less than `validate()`
does. Rather than duplicate or partially reproduce `@motionkit/core`'s validation
at the MCP layer, both tools accept `spec` as an opaque JSON value and delegate
all real validation to `validate()`/`render()` — the single source of truth,
already covering structural and semantic rules alike. This mirrors exactly how
the CLI commands work: they `JSON.parse` the spec file into `unknown` and hand
it straight to `validate()`, never pre-checking it against the Zod schema
themselves.

**2. `specDir` is a required, caller-supplied path; tools do no path inference
of their own.**

Unlike the CLI (which derives `specDir` from the spec file's own location), an
MCP tool call has no "current file" to derive a directory from — the spec
arrives as a JSON value, not a file path. Both tools require an explicit
`specDir` argument (an absolute path, documented as such) that assets and the
`brand` id resolve against, exactly as `validate()`/`render()` already expect.

**3. `render_video`'s `outputPath` is optional, defaulting to
`<specDir>/output.mp4` when omitted.**

The CLI defaults the output path from the spec _file's_ base name — there is no
equivalent name available here since the spec arrives as JSON, not a file. A
fixed `output.mp4` inside `specDir` is a predictable, simple default; an
explicit `outputPath` argument overrides it, mirroring the CLI's `--output`.

**4. Both tools report an invalid specification as a normal (non-`isError`)
result, not an MCP protocol error.**

"This Video Specification has validation problems" is an expected, useful
outcome for an agent iterating on a spec — not a tool execution failure. Both
tools always return the same JSON-serialized shape on the "ran successfully"
path: `validate_video` returns `ValidationResult` directly; `render_video`
returns either `{ outputPath }` on success or the same `ValidationResult`-shaped
failure (by catching `RenderValidationError` and re-using its `.errors`) on an
invalid spec — giving both tools one consistent "is this spec valid" shape for
an agent to branch on. `isError: true` is reserved for genuine execution
failures the agent can't fix by editing the spec: an unresolvable `specDir`,
an unexpected `render()` exception (e.g. `ffmpeg` failure), or a malformed tool
call. Those propagate as thrown errors from the tool functions, which
`index.ts`'s handler catches and reports via `isError: true`, distinct from a
structured validation failure.

**5. Tool logic lives in `packages/mcp/src/tools/validateVideo.ts` and
`renderVideo.ts` as plain async functions, matching `ping.ts`.**

`export async function validateVideo(input: { spec: unknown; specDir: string }): Promise<ValidationResult>`
and
`export async function renderVideo(input: { spec: unknown; specDir: string; outputPath?: string }): Promise<RenderVideoResult>`
(a small local union type: `{ outputPath: string } | { valid: false; errors: StructuredError[] }`).
`index.ts` wires each into `server.registerTool(...)`, JSON-serializing the
returned value into the tool result's text content — identical shape to how
`ping.ts`'s return value is serialized today.

## Risks / Trade-offs

- **A fixed `output.mp4` default could silently overwrite a previous render in
  the same `specDir` across repeated calls.** Acceptable: the caller can always
  pass an explicit `outputPath`, and this matches the low-stakes,
  iterate-and-re-render nature of the workflow this tool serves.
- **No session state means a multi-scene, multi-turn video-building
  conversation must carry the whole spec JSON on every call.** Accepted
  trade-off of the monolithic design choice — simpler and needs no new
  server-side state management; revisit with granular/incremental tools later
  if this proves cumbersome in practice.

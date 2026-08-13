## Purpose

Exposes MotionKit's Video Specification validation and rendering as MCP tools, so
an MCP client (an AI agent, or any other MCP-aware caller) can build and render a
video through the protocol MotionKit exists to serve, rather than only through
`@motionkit/cli`. Both tools are stateless, whole-spec-in/whole-result-out
mirrors of `@motionkit/core`'s `validate()`/`render()` — no server-held session
between calls.

## ADDED Requirements

### Requirement: `validate_video` tool

The MCP server SHALL expose a `validate_video` tool accepting a Video
Specification document and a `specDir` (the absolute path assets and the
`brand` id resolve against), returning the same structured validation result
`@motionkit/core`'s `validate()` produces.

#### Scenario: Valid specification reports success

- **WHEN** `validate_video` is called with a Video Specification that satisfies every structural and semantic rule, and its `specDir`
- **THEN** the tool returns a successful result indicating the specification is valid

#### Scenario: Invalid specification reports structured errors

- **WHEN** `validate_video` is called with a Video Specification that violates one or more rules
- **THEN** the tool returns a successful (non-error) result listing every violation as a structured error, matching `@motionkit/core`'s `validate()` output

#### Scenario: Multiple violations are all reported

- **WHEN** a specification passed to `validate_video` violates more than one rule
- **THEN** the tool's result includes all violations, not just the first

### Requirement: `render_video` tool

The MCP server SHALL expose a `render_video` tool accepting a Video
Specification document, a `specDir`, and an optional output path, rendering the
specification to MP4 via `@motionkit/core`'s `render()` when valid.

#### Scenario: Valid specification renders successfully

- **WHEN** `render_video` is called with a valid Video Specification, its `specDir`, and an output path
- **THEN** an MP4 file is written to that output path and the tool's result reports the output path

#### Scenario: Output path defaults when omitted

- **WHEN** `render_video` is called without an explicit output path
- **THEN** the rendered MP4 is written to a default path inside the given `specDir`

#### Scenario: Invalid specification is refused before rendering

- **WHEN** `render_video` is called with a Video Specification that fails validation
- **THEN** no video file is produced, and the tool's result reports the same structured errors `validate_video` would report for that specification, rather than a partial or corrupt output

### Requirement: Validation failures are not reported as tool execution errors

Both `validate_video` and `render_video` SHALL report an invalid Video
Specification as a normal, successful tool result — not an MCP protocol-level
error — reserving execution-error reporting for failures the caller cannot fix
by editing the specification (e.g. an unresolvable `specDir` or an unexpected
render failure).

#### Scenario: A structurally or semantically invalid spec is not a tool error

- **WHEN** either tool is called with a Video Specification that fails validation
- **THEN** the tool call itself succeeds, and the invalidity is communicated through the result's content, not through an MCP error response

#### Scenario: An unresolvable specDir is a tool error

- **WHEN** either tool is called with a `specDir` that cannot be resolved or read
- **THEN** the tool call reports an execution error rather than a validation result

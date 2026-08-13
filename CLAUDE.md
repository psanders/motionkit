# MotionKit — Agent Guide

MotionKit is a programmable, branded video engine exposed through MCP: an AI agent describes a
video in natural language, an agent layer turns that into a structured, versioned **Video
Specification** (a Zod schema), MotionKit validates it and renders it deterministically via
Remotion using a controlled vocabulary of primitives (`ARoll`, `BRoll`, `BrowserDemo`, `Text`,
`Transition`, ...).

## How work is organized

- **Coding conventions (the HOW)** live in this file. They apply to every change.
- **Product behavior (the WHAT)** lives in OpenSpec specs under `openspec/specs/`, changed
  through proposals in `openspec/changes/`. Use `/openspec:propose`, `/openspec:apply`,
  `/openspec:archive`. Specs describe observable, testable behavior — not coding style.
- **Shipping a change (the LOOP)** drives one change from design to archive with
  `/ps:ship <change>`: design → spec reconcile → build → tests → sync → archive,
  resumable via a per-change checkpoint.

## Repository layout

Monorepo (npm workspaces + Lerna), three packages:

- `packages/core` (`@motionkit/core`) — the shared package: Zod schemas, inferred types, error
  classes, pure utils, the validated-function spine (`withErrorHandlingAndValidation.ts` +
  `ValidationError.ts`), and the MotionKit engine itself:
  - `src/video-spec/` — the versioned Video Specification schema (`videoSpecSchema`), `a_roll`/
    `b_roll` scenes, and the `fade` transition.
  - `src/validation/` — `validate(spec, specDir)`, a non-throwing, multi-error validator
    (`ValidationResult`/`StructuredError`) for structural and semantic spec problems.
  - `src/rendering/` — the Remotion composition (`Timeline.tsx`) and `render(spec, specDir,
outputPath)`, a deterministic Video Specification → MP4 pipeline for the `16:9`/`9:16`
    formats.

  Depends on no other workspace package. `mcp` and `cli` both depend on it.

- `packages/mcp` (`@motionkit/mcp`) — the MCP server (`@modelcontextprotocol/sdk`), the primary
  surface AI agents talk to. Currently exposes one trivial `ping` tool proving the transport
  wires up; real tools (`create_video`, `add_a_roll`, ...) come later via OpenSpec changes.
- `packages/cli` (`@motionkit/cli`) — an oclif CLI (`@oclif/core`, `@inquirer/prompts`) for local/
  scripted use. Exposes `motionkit validate <spec.json>` and `motionkit render <spec.json>`
  (both thin wrappers over `@motionkit/core`), plus the original `motionkit ping` health check.
  See `packages/cli/examples/` for a runnable example spec.

No database — MotionKit has no persistence layer of its own; asset/spec state is either passed
through the MCP session or handled by the calling agent.

## Worked example

`packages/core/src/assets/createRegisterAsset.ts` + `asset.schema.ts` is the one worked example
of the validated-function pattern in this repo (an `Asset` has `name`, `type`
(`video`/`audio`/`image`/`font`), `path`, `tags`). Copy its shape for new business logic.

## Coding conventions

### Validated functions (preferred pattern for service/data functions)

Business logic uses the **validated-function** pattern: a factory that injects dependencies
and wraps an inner `fn` with `withErrorHandlingAndValidation(fn, schema)`, so invalid input
throws a structured `ValidationError` before the operation runs and tests inject stubs with
no live services. Schemas and client interfaces live in `@motionkit/core`. Apply it to
input-validating operations — not trivial pure helpers or framework glue.

Full guide, rationale, and scaffolding: `/ps:create-validated-function`
(source: github.com/psanders/psstack).

### General

- TypeScript strict; no `any` (ESLint enforces `@typescript-eslint/no-explicit-any`).
- ESM: relative imports carry the `.js` extension, even from `.ts` source.
- Share contracts via `@motionkit/core`; don't duplicate types across packages.

## Build plan (where things are headed)

The real product ships in phases via OpenSpec changes driven by `/ps:ship`:

1. **Foundation** ✅ — Video Specification schema, validation, deterministic Remotion render
   pipeline, `motionkit validate`/`motionkit render`. Landed by the `foundation` change.
2. **Design System** — the controlled vocabulary of primitives (`ARoll`, `BRoll`, `BrowserDemo`,
   `Text`, `Transition`, ...).
3. **Responsive Layout** — composition/layout rules across aspect ratios.
4. **MCP tool surface** — `create_video`, `add_a_roll`, etc., replacing the placeholder `ping`.
5. **AI Skill** — the agent-facing skill that turns natural language into a Video Specification.
6. **Preview/Iteration** — fast feedback loop for reviewing and revising a render.

## Commits

Use **Conventional Commits** (`type(scope): subject`, e.g. `feat(core): add asset schema`).
A Husky `commit-msg` hook runs commitlint and rejects non-conforming messages.

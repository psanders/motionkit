## Why

MotionKit currently has an empty engine: `@motionkit/core` proves the validated-function pattern with a placeholder Asset example, and `packages/cli`/`packages/mcp` only expose a `ping`. None of the actual product — a Video Specification an AI agent can generate, or a renderer that turns it into a video — exists yet. Per the phased build plan in `CLAUDE.md`, Phase 1 (Foundation) is the first vertical slice: prove `Video Specification → Remotion → rendered MP4` works end-to-end, deterministically, before layering brand, responsive layout, or MCP on top.

## What Changes

- Add a strongly-typed, versioned Video Specification schema (Zod, in `@motionkit/core`) describing a timeline of scenes, an output format, and fps.
- Add two first-class scene types: `a_roll` and `b_roll` (asset reference + duration), with A-roll audio able to continue underneath B-roll visuals in the composited timeline.
- Add one transition primitive: `fade`, applied between adjacent scenes.
- Add a validation function that checks a Video Specification structurally and semantically (referenced asset files exist on disk, scene durations are positive, format is one of the supported formats, transition type is recognized) and returns structured errors (a code, a human message, and — where applicable — suggestions) instead of throwing raw exceptions.
- Add a Remotion-based rendering pipeline in `@motionkit/core` that takes a validated Video Specification and renders a deterministic MP4: same spec + same assets → byte-identical (or frame-identical) output.
- Add format-aware composition: `16:9` (1920x1080) and `9:16` (1080x1920) are supported, each with its own composition dimensions — not one composition naively scaled.
- Replace/extend `packages/cli`'s `ping` command with two real commands: `motionkit validate <spec.json>` (reports structured errors, exit code reflects validity) and `motionkit render <spec.json>` (renders to an MP4, reports the output path).
- Out of scope for this change (explicitly deferred to later phases per `CLAUDE.md`): MCP tool surface (Phase 4), brand system / typography / captions / browser frame (Phase 2), pan/zoom/crop/focal-point motion (Phase 3), the `1:1` format, and any transition besides `fade`.

## Capabilities

### New Capabilities

- `video-spec`: the Zod schema, types, and versioning for the Video Specification document (formats, fps, scene list, scene types `a_roll`/`b_roll`, `fade` transition).
- `video-validation`: structural + semantic validation of a Video Specification, returning structured, AI-correctable errors.
- `video-rendering`: the Remotion composition + render pipeline that turns a validated Video Specification into a deterministic MP4, for the `16:9` and `9:16` formats.
- `cli-video-commands`: the `motionkit validate` and `motionkit render` CLI commands in `packages/cli`.

### Modified Capabilities

(none — the existing Asset capability in `@motionkit/core` is unchanged by this work; scenes reference assets by path but don't change how assets themselves are registered/validated)

## Impact

- **`packages/core`**: new `src/video-spec/` (schema, types), `src/validation/` (validator + structured error types), `src/rendering/` (Remotion compositions + render pipeline). New runtime dependency on `remotion`/`@remotion/renderer` (already installed but unused). New dev-time dependency on a sample/fixture video asset for tests.
- **`packages/cli`**: `src/commands/validate.ts` and `src/commands/render.ts` replace `ping` as the primary commands (ping can stay as a lightweight health check or be removed — decide in design).
- **No changes** to `packages/mcp` (Phase 4 work) or brand/theme system (Phase 2 work) — those packages/areas are untouched.
- **New fixture assets**: a couple of short local video files needed for rendering tests/examples live under a test-fixtures directory (not committed as large binaries if avoidable — see design.md for the approach).

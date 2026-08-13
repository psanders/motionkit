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
  - `src/brand/` — the Brand schema (`brandSchema`: colors, typography, logo, spacing,
    border-radius, shadows, and per-primitive style tokens — including `browserFrameStyle`,
    `phoneFrameStyle`, and `pipStyle`), and a registry (`findBrand`, non-throwing; `loadBrand`,
    throwing) that resolves a brand id to its parsed, validated document. A brand lives in its
    own `<id>.brand.json` file, checked at `<specDir>/brands/` first, then falling back to the
    package's built-in `src/brand/brands/` (ships one brand, `"default"`) — never inlined into a
    Video Specification. A logo's `asset` path resolves relative to the brand file's own
    directory, not the spec's.
  - `src/video-spec/` — the versioned Video Specification schema (`videoSpecSchema`), `a_roll`/
    `b_roll` scenes, an optional top-level `brand` id (defaults to `"default"`), an optional
    top-level `overlays` array, and optional scene-level `caption`, `frame` (`"browser"`/
    `"phone"`), `logo`, and `motion` fields.
    `motion` is semantic pan/zoom/crop intent (`horizontal_pan`/`vertical_pan`/`zoom`/`static` +
    an optional `focalPoint`), independent of `frame` — see `src/rendering/cropTransform.ts` for
    how it becomes an actual crop. `overlays` is scene-anchored (each entry references a
    `sceneIndex`, not an absolute time range) — the only overlay type today is `pip`, a video
    bubble (`position`/`shape`/`size`, defaulted from the active brand's `pipStyle`, plus a
    required `audio: "own" | "muted"`) rendered on top of its target scene's other layers; `"own"`
    is the common case of no separate A-roll at all, just a continuous B-roll with a narrating
    webcam bubble. Transitions support `fade`, `slide-left`, `slide-right`, and `zoom`, each with
    an optional explicit `duration` — when omitted, the active brand's
    `defaultTransitionDurationSeconds` applies at render time. Formats: `16:9`, `9:16`, `1:1`.
  - `src/validation/` — `validate(spec, specDir)`, a non-throwing, multi-error validator
    (`ValidationResult`/`StructuredError`) for structural and semantic spec problems, including
    brand resolution (`BRAND_NOT_FOUND`, with available brand ids as suggestions), the scene
    fields (`EMPTY_CAPTION`, `UNSUPPORTED_FRAME`, `UNSUPPORTED_LOGO_POSITION`), `motion`
    (`UNSUPPORTED_MOTION_TYPE`, `MOTION_DIRECTION_MISMATCH`, `FOCAL_POINT_OUT_OF_BOUNDS`), and
    overlays (`OVERLAY_SCENE_INDEX_OUT_OF_RANGE`, `UNSUPPORTED_OVERLAY_POSITION`, and the same
    `ASSET_NOT_FOUND` scene assets already get). Stays synchronous — real asset dimensions are
    only probed at render time, never during validation.
  - `src/rendering/` — the Remotion composition (`Timeline.tsx`) and `render(spec, specDir,
outputPath)`, a deterministic Video Specification → MP4 pipeline for the `16:9`/`9:16`/`1:1`
    formats. Captions, the chrome frame decoration, the logo, and any PIP overlays anchored to a
    scene render as additive layers within that scene's existing `<Sequence>` (not new scene
    types), all styled from the resolved brand. `probeAssetDimensions.ts` (`ffprobe`-based,
    cached per render) supplies each scene asset's real dimensions to `cropTransform.ts`'s "cover
    crop with a moving window" math — the actual scale/translate a scene's visual renders at, at
    a given frame, per its `motion`. An own-audio PIP's audio span (`audioSpans.ts`'s
    `deriveOverlayAudioSpans`) is independent of the scene's own A-roll-continuity audio span —
    deliberately no automatic ducking if both are present on the same scene at once.

  Depends on no other workspace package. `mcp` and `cli` both depend on it.

- `packages/mcp` (`@motionkit/mcp`) — the MCP server (`@modelcontextprotocol/sdk`), the primary
  surface AI agents talk to. Currently exposes one trivial `ping` tool proving the transport
  wires up; real tools (`create_video`, `add_a_roll`, ...) come later via OpenSpec changes.
- `packages/cli` (`@motionkit/cli`) — an oclif CLI (`@oclif/core`, `@inquirer/prompts`) for local/
  scripted use. Exposes `motionkit validate <spec.json>` and `motionkit render <spec.json>`
  (both thin wrappers over `@motionkit/core`), plus the original `motionkit ping` health check.
  See `packages/cli/examples/` for runnable example specs (Phase 1's `spec.json`, Phase 2's
  brand/caption/frame/logo/transition-demonstrating `brand-spec.json`, Phase 3a's
  motion/phone-frame/`1:1`-demonstrating `motion-spec.json`, and Phase 3b's
  overlays/PIP-demonstrating `overlays-spec.json`).

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
2. **Design System** ✅ — the Brand system, scene `caption`/`frame`/`logo`, and the expanded
   transition vocabulary. Landed by the `brand-system` change.
3. **Responsive Layout** ✅ — composition/layout rules across aspect ratios. Shipped as two
   changes: `responsive-motion` (scene `motion`, `frame: "phone"`, the `1:1` format, and the
   crop/pan/zoom render math) and `overlays-pip` (the scene-anchored `overlays[]` array and the
   `pip` webcam-bubble overlay type).
4. **MCP tool surface** — `create_video`, `add_a_roll`, etc., replacing the placeholder `ping`.
5. **AI Skill** — the agent-facing skill that turns natural language into a Video Specification.
6. **Preview/Iteration** — fast feedback loop for reviewing and revising a render.

## Commits

Use **Conventional Commits** (`type(scope): subject`, e.g. `feat(core): add asset schema`).
A Husky `commit-msg` hook runs commitlint and rejects non-conforming messages.

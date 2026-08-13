## Context

`@motionkit/core` currently only contains the bootstrap-proving Asset example (schema + `createRegisterAsset` + validated-function spine) and has `remotion`/`@remotion/renderer` installed but unused. `packages/cli` only has a `ping` command. See proposal.md for why this phase exists; see the four spec files under `specs/` for the exact behavior contracts this design implements.

## Goals / Non-Goals

**Goals:**

- Land a deterministic `Video Specification → Remotion → MP4` pipeline for `a_roll`/`b_roll` scenes, one `fade` transition, and the `16:9`/`9:16` formats.
- Keep the Video Specification and validator's public surface stable enough that later phases (brand system, more transitions, pan/zoom, MCP) extend it without breaking this phase's contract.

**Non-Goals:**

- No MCP tools (Phase 4) — the spec/validator/renderer are plain library functions in `@motionkit/core`, called directly by the CLI in this phase.
- No brand system, typography, captions, or browser/phone frames (Phase 2).
- No pan/zoom/crop/focal-point motion, no `1:1` format (Phase 3).
- No transitions beyond `fade`.
- No persistence/database — the CLI is stateless; a spec is a JSON file in, an MP4 file out.

## Decisions

### 1. Video Spec schema lives in `@motionkit/core/src/video-spec/`, Zod-first

`schema.ts` defines `videoSpecSchema` (and `sceneSchema` as a discriminated union on `type`: `a_roll` | `b_roll`) via `zod/v4`; `types.ts` re-exports the inferred types (`VideoSpec`, `Scene`, `ARollScene`, `BRollScene`). `version` is a string literal `"1"` for now (schema is versioned from day one per the product brief, even though there's only one version yet) — a future version bump adds a new literal to a union rather than mutating this one, keeping old specs parseable.

- **Alternative considered**: a hand-written TS interface + separate validation logic. Rejected — Zod gives us runtime validation and static types from one source, which the validation capability depends on directly.

### 2. Validation is a pure function returning a result object, never throwing

`validate(spec: unknown): ValidationResult` where `ValidationResult = { valid: true } | { valid: false, errors: StructuredError[] }` and `StructuredError = { code: string, message: string, path?: string, suggestions?: string[] }`. Structural checks (Zod `safeParse`) run first; semantic checks (asset existence, positive durations, format/transition support) run only against a structurally valid document, and all semantic violations are collected before returning (not fail-fast) so an AI agent gets the full error list in one round trip.

- **Alternative considered**: throwing `ValidationError` (the existing pattern from the Asset example, via `withErrorHandlingAndValidation`). Rejected for this specific function — `withErrorHandlingAndValidation` fits request/response-style operations with one input shape; validation-as-a-tool needs to _return_ a multi-error report to an AI caller, not raise on the first problem. `render` and the CLI commands still use the standard validated-function pattern where they call `validate()` internally and turn a failure result into their own error handling.
- Asset existence uses `fs.existsSync` resolved relative to the spec file's directory (not cwd), so specs are portable; the "suggestions" list is `fs.readdirSync` on the asset's parent directory, filtered to file entries.

### 3. Rendering: one Remotion project, two `<Composition>`s (format-aware, not scaled)

`src/rendering/` hosts a Remotion entry point with two registered compositions, `MotionKit16x9` (1920x1080) and `MotionKit9x16` (1080x1920), both driven by the same root component (`<Timeline spec={videoSpec} />`) — the component reads `spec.format` from its own props to decide layout, rather than one composition being CSS-scaled into the other's aspect ratio. For Phase 1 both formats lay out scenes identically (full-bleed video, centered/cropped to fill frame); format-aware _content_ differences (e.g. browser demo panning) start in Phase 3.

- `Timeline` maps `scenes[]` to Remotion `<Sequence>`s with `durationInFrames = duration * fps`, offset by the cumulative sum of prior scene durations (in frames).
- **A-roll audio continuity**: each `a_roll` scene's `<Sequence>` renders an `<Audio>` extracted from its asset spanning its own frame range _plus_ the frame ranges of any immediately-following `b_roll` scenes that default to `audio: "continue"` (stops at the next scene that breaks the chain — another `a_roll`, or a `b_roll` with `audio: "muted"`). This is computed once as a derived "audio spans" list before rendering `<Sequence>`s, not decided per-frame.
- **Fade transition**: a scene with `transition: { type: "fade" }` wraps its `<Sequence>` content in an opacity `interpolate()` driven by `useCurrentFrame()` over a fixed, short duration (e.g. 15 frames) at the start of its span — a plain interpolation, not `@remotion/transitions`, to keep the dependency surface small for one transition type. Revisit `@remotion/transitions` when more transition types land.
- Render is invoked via `@remotion/renderer`'s `renderMedia` (programmatic API, not shelling out to `remotion render`), called from a `render(spec, outputPath)` function in `@motionkit/core` — `bundle()` once per process, `selectComposition()` by format, then `renderMedia()`.
- **Determinism**: no `Math.random()`, `Date.now()`, or wall-clock-dependent values anywhere in the composition; frame content is a pure function of `(spec, frame)`. `renderMedia` is called with a fixed `codec: "h264"` and consistent encoding settings so repeated renders of the same input are frame-for-frame identical (audio-container timestamp metadata can differ trivially across runs — the determinism scenario is verified by decoding frames/audio samples and comparing, not by raw byte-diffing the MP4 container).

### 4. Test fixtures: generate synthetic sample videos at test time, don't commit binaries

Committing real video files to git bloats the repo and this pattern would only get worse as more fixtures are needed. Instead, a small test helper (`test/fixtures/generateSampleVideo.ts`) shells out to `ffmpeg` (already a transitive dependency of `@remotion/renderer`'s toolchain) to synthesize short, deterministic test clips (e.g. `ffmpeg -f lavfi -i testsrc=duration=2:size=640x360:rate=30 -f lavfi -i sine=frequency=440:duration=2 ...`) into a gitignored temp/fixtures directory before the rendering test suite runs. This keeps the repo lean and every fixture reproducible from a one-line command instead of a binary blob.

- **Alternative considered**: committing 2-3 small real MP4s. Rejected — even "small" video files churn the repo size over time and complicate diffs; synthetic generation is just as good for testing scene sequencing, audio continuity, and format dimensions, none of which depend on real footage content.

### 5. CLI commands are thin wrappers over `@motionkit/core`

`packages/cli/src/commands/validate.ts` and `render.ts` (oclif commands) call `@motionkit/core`'s `validate()` and `render()` directly — no new business logic in the CLI package, matching the "transport is thin" convention. `ping` is kept as-is (cheap health check, no reason to remove it).

## Risks / Trade-offs

- **[Risk] Remotion's `renderMedia` is CPU/time-heavy, slowing the test suite.** → Mitigation: keep test-fixture clips very short (1-3s) and low-resolution; reserve a full 16:9/9:16-at-spec-resolution render for one or two integration tests, not the whole suite.
- **[Risk] Frame-exact determinism across machines/ffmpeg versions is not fully guaranteed by encoder defaults.** → Mitigation: pin explicit encoding settings (codec, crf, pixel format) in the `renderMedia` call rather than relying on defaults, and scope the determinism scenario to "same machine, same toolchain versions" for this phase — cross-environment bit-identical output is not a Phase 1 claim.
- **[Trade-off] Audio-continuation is computed via a simple "chain forward from the last A-roll" rule, not an explicit per-scene audio graph.** Simpler to implement and validate now; if a future phase needs richer audio routing (music beds, sound effects mixed under narration), this will need to become an explicit audio-track model rather than an implicit chaining rule — acceptable since the product brief calls that out as a later capability, not this phase's.

## Open Questions

None — the audio-continuation rule, fixture strategy, and transition implementation approach above are all resolved decisions for this phase, not deferred unknowns.

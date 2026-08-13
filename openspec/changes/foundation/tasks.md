## 1. Video Specification schema

- [x] 1.1 Create `packages/core/src/video-spec/schema.ts`: `videoSpecSchema` (version, format, fps, scenes) and `sceneSchema` as a discriminated union on `type` (`a_roll` | `b_roll`), each with `asset` (string) and `duration` (positive number); `b_roll` adds optional `audio` (`"continue"` | `"muted"`, default `"continue"`); non-first scenes may declare `transition: { type: "fade" }`.
- [x] 1.2 Create `packages/core/src/video-spec/types.ts` re-exporting inferred types (`VideoSpec`, `Scene`, `ARollScene`, `BRollScene`, `Transition`).
- [x] 1.3 Create `packages/core/src/video-spec/index.ts` barrel export.
- [x] 1.4 Write `packages/core/test/video-spec/schema.test.ts` covering: well-formed doc accepted, missing required field rejected, both scene types accepted, unknown scene type rejected, default vs. explicit `audio` on b_roll, fade transition accepted, unsupported transition type rejected, both formats accepted, unsupported format rejected (per `specs/video-spec/spec.md`).

## 2. Validation

- [x] 2.1 Create `packages/core/src/validation/errors.ts`: `StructuredError` type (`code`, `message`, `path?`, `suggestions?`) and a fixed set of error codes (e.g. `MALFORMED_SPEC`, `ASSET_NOT_FOUND`, `INVALID_DURATION`, `UNSUPPORTED_FORMAT`, `UNSUPPORTED_TRANSITION`).
- [x] 2.2 Create `packages/core/src/validation/validate.ts`: `validate(spec: unknown, specDir: string): ValidationResult`. Structural check first (Zod `safeParse`, short-circuits with `MALFORMED_SPEC` errors); on structural success, run all semantic checks (asset existence via `fs.existsSync` resolved against `specDir`, with sibling-directory suggestions; positive duration; supported format; supported transition) and collect every violation before returning.
- [x] 2.3 Create `packages/core/src/validation/index.ts` barrel export.
- [x] 2.4 Write `packages/core/test/validation/validate.test.ts` covering every scenario in `specs/video-validation/spec.md`: structural failure, missing asset (+ suggestions), non-positive duration, unsupported format, unsupported transition, multiple simultaneous violations all reported, validation never throws, and a fully valid spec passes with an empty error list.

## 3. Rendering

- [x] 3.1 Create the Remotion entry (`packages/core/src/rendering/index.tsx` or `remotion.entry.tsx` per Remotion's `bundle()` convention) registering two `<Composition>`s, `MotionKit16x9` (1920x1080) and `MotionKit9x16` (1080x1920), both rendering a shared `Timeline` root component.
- [x] 3.2 Create `packages/core/src/rendering/Timeline.tsx`: maps `spec.scenes` to Remotion `<Sequence>`s offset by cumulative prior-scene duration (in frames = `duration * spec.fps`); renders each scene's `asset` as `<Video>` (or `<OffthreadVideo>`) filling the frame.
- [x] 3.3 Implement A-roll audio continuity: derive an "audio spans" list (which frame ranges each A-roll's audio should cover, extended through consecutive B-roll scenes with `audio: "continue"`, stopping at the next A-roll or a `audio: "muted"` B-roll) and render the corresponding `<Audio>` elements per span.
- [x] 3.4 Implement the `fade` transition: for a scene declaring `transition: { type: "fade" }`, wrap its content in an opacity `interpolate()` over a fixed short frame window (e.g. 15 frames) driven by `useCurrentFrame()`.
- [x] 3.5 Create `packages/core/src/rendering/render.ts`: `render(spec: VideoSpec, specDir: string, outputPath: string): Promise<void>` — calls `validate()` first and refuses to render (returning/throwing the structured errors) on failure; on success, `bundle()` the Remotion entry, `selectComposition()` by `spec.format`, and `renderMedia()` with fixed encoding settings (explicit codec/crf/pixel format, no defaults left implicit) to the given `outputPath`.
- [x] 3.6 Create `packages/core/test/fixtures/generateSampleVideo.ts`: a helper that shells out to `ffmpeg` to synthesize short deterministic test clips (e.g. `testsrc` + `sine` lavfi sources) into a gitignored fixtures directory; add the fixtures output dir to `.gitignore`.
- [x] 3.7 Write `packages/core/test/rendering/render.test.ts` covering: valid spec renders an MP4, rendered duration equals the sum of scene durations, scene order matches the spec, continued audio is audible under B-roll / muted B-roll has none, a fade-declared scene shows a fade (assert the opacity ramp via frame extraction, not eyeballing), 16:9 renders at 1920x1080, 9:16 renders at 1080x1920, rendering the same spec twice produces frame-for-frame equivalent output, and an invalid spec is rejected before any file is written.

## 4. CLI commands

- [x] 4.1 Create `packages/cli/src/commands/validate.ts` (oclif command): reads the spec file argument, calls `@motionkit/core`'s `validate()`, prints a success message and exits 0 on success, or prints the structured errors and exits non-zero on failure.
- [x] 4.2 Create `packages/cli/src/commands/render.ts` (oclif command): reads the spec file argument and an optional output-path flag (defaulting to a sensible location, e.g. alongside the spec file or a `./out/` dir, reported either way); calls `@motionkit/core`'s `render()`; prints the output path and exits 0 on success, or prints validation errors and exits non-zero without writing a file on failure.
- [x] 4.3 Write `packages/cli/test/validate.test.ts` and `packages/cli/test/render.test.ts` covering every scenario in `specs/cli-video-commands/spec.md` (success/failure exit codes and output, default vs. explicit output path).

## 5. Wiring and verification

- [x] 5.1 Add an example Video Specification JSON (using the generated sample fixtures or a documented equivalent) under `packages/core/examples/` or `packages/cli/examples/` for manual smoke-testing (`motionkit validate` / `motionkit render` against it).
- [x] 5.2 Update root `CLAUDE.md` / package READMEs to describe the new `video-spec`, `validation`, and `rendering` modules and the two CLI commands, replacing the "Phase 1 not yet built" note.
- [x] 5.3 Run lint, typecheck, and the full test suite (including the rendering tests) across all workspaces; fix anything red before this change is ready to sync/archive.

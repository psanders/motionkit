## 1. Schema

- [x] 1.1 Add optional `sourceStartSeconds`/`sourceEndSeconds` (`z.number().nonnegative()`) to `sceneBaseSchema` in `packages/core/src/video-spec/schema.ts`
- [x] 1.2 Add the same optional fields to `pipOverlaySchema`
- [x] 1.3 Add a `.refine`/`.superRefine` (scene) and equivalent (overlay) enforcing `sourceEndSeconds > sourceStartSeconds` when both are present, producing a Zod issue that maps to the existing generic malformed-spec structural error
- [x] 1.4 Confirm inferred TypeScript types (`VideoSpec`, scene/overlay types in `video-spec/types.ts` or equivalent) pick up the new fields with no manual type edits needed

## 2. Validation

- [x] 2.1 Add `StructuredErrorCode.SOURCE_RANGE_EXCEEDS_ASSET_DURATION` to `packages/core/src/validation/errors.ts`
- [x] 2.2 Confirm the structural `sourceEndSeconds > sourceStartSeconds` check (from 1.3) surfaces as a `ValidationResult` failure via `validate()`, with a test asserting the offending scene/overlay is identified
- [x] 2.3 Add a render-time duration-bounds check (new function, e.g. `checkSourceRangeFitsAsset`) that uses `probeAssetDurationSeconds()` (task 3.1) to verify a scene's/overlay's source range fits the real asset and covers `duration`, returning `SOURCE_RANGE_EXCEEDS_ASSET_DURATION` on failure
- [x] 2.4 Wire the render-time check into `render()` so it runs before Remotion is invoked, refusing to render (no partial/corrupt output) on failure, consistent with existing invalid-specification handling

## 3. Rendering — asset probing

- [x] 3.1 Add `probeAssetDurationSeconds()` to `packages/core/src/rendering/probeAssetDimensions.ts` (or a sibling file), mirroring `probeAssetDimensions()`'s `ffprobe` invocation and per-resolved-path caching pattern
- [x] 3.2 Add `clearAssetDurationCache()` for test isolation, mirroring `clearAssetDimensionsCache()`

## 4. Rendering — visual layer

- [x] 4.1 In `Timeline.tsx`'s `SceneVisual`, compute `trimBefore`/`trimAfter` (in frames, rounded) from a scene's `sourceStartSeconds`/`sourceEndSeconds` and pass them to `<OffthreadVideo>`
- [x] 4.2 In `Timeline.tsx`'s `PipOverlay`, do the same for a PIP overlay's own `sourceStartSeconds`/`sourceEndSeconds`
- [x] 4.3 Confirm omitted source fields produce no `trimBefore`/`trimAfter` props (i.e. today's default-from-0 behavior is byte-identical)

## 5. Rendering — audio layer

- [x] 5.1 Add an optional `sourceStartFrame` field to `AudioSpan` in `audioSpans.ts`
- [x] 5.2 In `deriveAudioSpans()`, populate `sourceStartFrame` from the originating A-roll's `sourceStartSeconds` when a new span opens; leave it unset for spans with no offset
- [x] 5.3 In `deriveOverlayAudioSpans()`, populate `sourceStartFrame` from the overlay's `sourceStartSeconds`
- [x] 5.4 In `Timeline.tsx`, pass `trimBefore={span.sourceStartFrame}` to each `<Audio>` Sequence built from an `AudioSpan`

## 6. Tests

- [x] 6.1 Schema tests: valid spec with `sourceStartSeconds` only, with both fields, with neither (unchanged behavior); invalid spec with negative values; invalid spec with `sourceEndSeconds <= sourceStartSeconds` (scene and overlay)
- [x] 6.2 Validation unit tests, including a validation-failure case per `CLAUDE.md` convention (structured error + no render side effect) for the range-consistency check
- [x] 6.3 Render-time duration-bounds test: source range beyond asset duration is rejected before any file is written; source range too short for `duration` is rejected
- [x] 6.4 `probeAssetDurationSeconds()` unit test against a known fixture duration, plus a cache-hit test (no repeated `ffprobe` shell-out)
- [x] 6.5 Render test: a scene with `sourceStartSeconds` produces visibly different frame content at t=0 than the same asset without it (pixel-probe or frame-hash comparison against an untrimmed render), using a fixture generated via the existing `generateSampleVideo.ts` helper
- [x] 6.6 Render test: a trimmed A-roll's audio and a chained "continue" B-roll under it still align — same approach as existing audio-span render tests
- [x] 6.7 Render test: a PIP overlay with `sourceStartSeconds` and `audio: "own"` renders the correct trimmed slice for both its bubble and its audio
- [x] 6.8 Full-suite regression: existing tests with no source-offset fields still pass unchanged (confirms zero behavior change for existing specs)

## 7. Docs

- [x] 7.1 Document `sourceStartSeconds`/`sourceEndSeconds` in the root README's "Writing a Video Specification" section, alongside the other scene/overlay fields
- [x] 7.2 Add or update an example spec under `packages/cli/examples/` demonstrating a trimmed scene, if one doesn't already cover it

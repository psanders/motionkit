## 1. Video Specification schema changes

- [x] 1.1 Update `packages/core/src/video-spec/schema.ts`: add `motionSchema` as a discriminated union on `type` (`horizontal_pan` with `direction: "left_to_right" | "right_to_left"` defaulting to `"left_to_right"`; `vertical_pan` with `direction: "top_to_bottom" | "bottom_to_top"` defaulting to `"top_to_bottom"`; `zoom` with no `direction`; `static` with no `direction`), each with an optional shared `focalPoint: { x: number, y: number }`; add optional `motion` to the scene base schema.
- [x] 1.2 Update `frame` to `z.enum(["browser", "phone"])` (was `z.literal("browser")`).
- [x] 1.3 Update `videoFormatSchema` to `z.enum(["16:9", "9:16", "1:1"])`.
- [x] 1.4 Update `packages/core/src/video-spec/types.ts` to re-export the new/changed inferred types (`Motion`, updated `Scene`, updated `VideoFormat`).
- [x] 1.5 Update `packages/core/test/video-spec/schema.test.ts` (extend) covering every new/changed scenario in `specs/video-spec/spec.md`: all four motion types accepted with correct direction defaults, direction overrides accepted, focal point optional, unrecognized motion type rejected, direction/type mismatch rejected structurally, motion usable without frame, phone frame accepted, unrecognized frame value still rejected, `1:1` format accepted.

## 2. Brand schema changes

- [x] 2.1 Update `packages/core/src/brand/schema.ts`: add `phoneFrameStyle` (same shape as `browserFrameStyle`: `chromeColor`, `chromeHeightPx`, `borderRadius`, `shadow`) as a required field.
- [x] 2.2 Update `packages/core/src/brand/brands/default.brand.json` and `packages/cli/examples/brands/acme.brand.json` to include `phoneFrameStyle`.
- [x] 2.3 Update `packages/core/test/brand/schema.test.ts` (extend) covering the new required token category per `specs/brand-system/spec.md`.

## 3. Validation changes

- [x] 3.1 Update `packages/core/src/validation/errors.ts`: add error codes `UNSUPPORTED_MOTION_TYPE`, `MOTION_DIRECTION_MISMATCH` (only reachable if a hand-built spec object bypasses the discriminated-union schema — see design.md decision #5, which structurally prevents this at the Zod layer for JSON input), `FOCAL_POINT_OUT_OF_BOUNDS`.
- [x] 3.2 Update `packages/core/src/validation/validate.ts`: extend the format check to the 3-value enum; extend the frame check to `browser`/`phone`; add a focal-point bounds check (`0`–`1` inclusive on both axes) collected alongside existing semantic checks.
- [x] 3.3 Update `packages/core/test/validation/validate.test.ts` (extend) covering every new/changed scenario in `specs/video-validation/spec.md`: unsupported format (3-value message), unsupported frame (2-value message), out-of-bounds focal point rejected (both axes), in-bounds focal point passes.

## 4. Asset dimension probing

- [x] 4.1 Create `packages/core/src/rendering/probeAssetDimensions.ts`: `probeAssetDimensions(assetPath): Promise<{ width: number, height: number }>` shelling out to `ffprobe`, with an in-memory per-render cache keyed by resolved asset path.
- [x] 4.2 Write `packages/core/test/rendering/probeAssetDimensions.test.ts`: probes a known synthetic fixture (generated via the existing `generateSampleVideo.ts` helper at a known resolution) and asserts the returned dimensions match; asserts a second probe of the same path doesn't re-invoke `ffprobe` (cache hit, verified via a spy/stub on the shell-out).

## 5. Crop/pan/zoom rendering math

- [x] 5.1 Create `packages/core/src/rendering/cropTransform.ts`: pure function(s) implementing design.md decision #1's math — cover-scale, clamped slack, `static`/`horizontal_pan`/`vertical_pan`/`zoom` transform resolution given `(sourceWidth, sourceHeight, targetWidth, targetHeight, motion, frame)` and the current frame number. Exported so tests can compute the same transform the renderer uses instead of duplicating the formula.
- [x] 5.2 Write `packages/core/test/rendering/cropTransform.test.ts`: unit tests for the pure math — cover-scale correctness for both wider-than-target and taller-than-target sources, slack clamping at both extremes, `horizontal_pan`/`vertical_pan` direction ordering (start vs. end position matches `direction`), `zoom` scale increasing monotonically toward the focal point, `static` with an off-center focal point producing a non-centered but clamped transform, no-motion defaulting to a centered `static` transform.

## 6. Rendering wiring

- [x] 6.1 Update `packages/core/src/rendering/render.ts`: probe every referenced scene asset's dimensions (via `probeAssetDimensions`) before bundling, once per unique asset path; pass the resulting dimension map into the composition's `inputProps` alongside spec/brand.
- [x] 6.2 Update `packages/core/src/rendering/Timeline.tsx`'s `SceneVisual`: replace the flat `object-fit: cover` with the computed `cropTransform` result (`transform: translate(...) scale(...)` per current frame), reusing `resolveTransitionDurationInFrames`'s pattern for resolving per-scene, per-frame values.
- [x] 6.3 Extend the `frame` wrapper component to branch on `"browser"` vs `"phone"`, reading `brand.browserFrameStyle` or `brand.phoneFrameStyle` respectively (same rendering structure, different token source).
- [x] 6.4 Add `MotionKit1x1` (1080x1080) to `packages/core/src/rendering/remotion.entry.tsx`; update `compositionIdFor()` in `render.ts` to route `1:1` to it.
- [x] 6.5 Write/extend `packages/core/test/rendering/render.test.ts` covering every new/changed scenario in `specs/video-rendering/spec.md`: horizontal/vertical pan reveal different source regions at start vs. end of the scene (pixel/region probes at both ends, not just "it rendered" — per design.md's stated risk mitigation), zoom scale increases over the scene, static+focal-point crop is off-center and matches the expected clamped position, no-motion scene keeps the prior centered-crop behavior (regression), phone frame renders visibly distinct from browser frame, motion composes correctly with a frame decoration, `1:1` renders at 1080x1080.

## 7. Wiring and verification

- [x] 7.1 Add a third example Video Specification JSON under `packages/cli/examples/` demonstrating `motion` (at least one pan and the zoom type), `frame: "phone"`, and the `1:1` format — in addition to the two existing examples, which must keep working unchanged (no `motion`/no `frame: "phone"`/no `1:1` in either).
- [x] 7.2 Update root `CLAUDE.md` / package READMEs to describe `motion`, the expanded `frame` enum, and the `1:1` format.
- [x] 7.3 Run lint, typecheck, and the full test suite (including the rendering tests) across all workspaces; fix anything red before this change is ready to sync/archive. Confirm both existing example specs (Phase 1's and Phase 2's) still validate and render unchanged.

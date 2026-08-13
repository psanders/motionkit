## 1. Video Specification schema changes

- [x] 1.1 Update `packages/core/src/video-spec/schema.ts`: add `pipOverlaySchema` (`type: z.literal("pip")`, `sceneIndex: z.number().int().nonnegative()`, `asset: z.string().min(1)`, `position: placementSchema.optional()`, `shape: z.enum(["circle", "rounded_square"]).default("circle")`, `size: z.enum(["sm", "md", "lg"]).default("md")`, `audio: z.enum(["own", "muted"])`) and `overlaySchema = z.discriminatedUnion("type", [pipOverlaySchema])`; add optional `overlays: z.array(overlaySchema).optional()` to `videoSpecSchema`.
- [x] 1.2 Update `packages/core/src/video-spec/types.ts` to re-export the new inferred types (`Overlay`, `PipOverlay`).
- [x] 1.3 Update `packages/core/test/video-spec/schema.test.ts` (extend) covering every new/changed scenario in `specs/video-spec/spec.md`: overlays array accepted/optional, well-formed PIP overlay accepted, audio required, position/shape/size defaults and overrides, multiple overlays on the same sceneIndex accepted.

## 2. Brand schema changes

- [x] 2.1 Update `packages/core/src/brand/schema.ts`: add `pipStyleSchema` (`size: scaleSchema`, `borderWidth: z.number().nonnegative()`, `borderColor: z.string().min(1)`, `shadow: z.string()`, `defaultPosition: placementSchema`) as a required `pipStyle` field on `brandSchema`.
- [x] 2.2 Update `packages/core/src/brand/brands/default.brand.json` and `packages/cli/examples/brands/acme.brand.json` to include `pipStyle`.
- [x] 2.3 Update `packages/core/test/brand/schema.test.ts` (extend) covering the new required token category per `specs/brand-system/spec.md`.

## 3. Validation changes

- [x] 3.1 Update `packages/core/src/validation/errors.ts`: add error codes `OVERLAY_SCENE_INDEX_OUT_OF_RANGE`, `UNSUPPORTED_OVERLAY_POSITION`. Reuse the existing `ASSET_NOT_FOUND` code for overlay assets (no new code needed there).
- [x] 3.2 Update `packages/core/src/validation/validate.ts`: for each overlay, check `sceneIndex` is within `[0, scenes.length)` (`OVERLAY_SCENE_INDEX_OUT_OF_RANGE` on failure); reuse `checkAssetExists` for the overlay's `asset`, resolved against `specDir` (same as scene assets, not the brand's directory); map an invalid `position` structural issue to `UNSUPPORTED_OVERLAY_POSITION` in `toStructuredError`, mirroring the existing `UNSUPPORTED_LOGO_POSITION` mapping. All checks collected alongside existing semantic checks — never fail-fast.
- [x] 3.3 Update `packages/core/test/validation/validate.test.ts` (extend) covering every new/changed scenario in `specs/video-validation/spec.md`: out-of-range sceneIndex rejected (both negative and beyond-last-scene cases), in-range sceneIndex passes, missing overlay asset reported (with suggestions), unsupported overlay position rejected, multiple violations across one overlay reported together.

## 4. Rendering: PIP bubble

- [x] 4.1 Update `packages/core/src/rendering/Timeline.tsx`'s `SceneLayers`: for each `overlays[]` entry whose `sceneIndex` matches the current scene index, render a `PipOverlay` layer after frame/caption/logo — a fixed-size, shape-clipped (`border-radius: 50%` for `circle`, a fixed large radius for `rounded_square`) `<OffthreadVideo object-fit: cover>` sized via `brand.pipStyle.size[overlay.size]`, bordered/shadowed via `brand.pipStyle.borderWidth`/`borderColor`/`shadow`, positioned via `overlay.position ?? brand.pipStyle.defaultPosition` reusing the existing `POSITION_STYLES` map (do not duplicate it).
- [x] 4.2 Thread `spec.overlays` (or a pre-grouped per-scene-index map, computed once alongside `withOffsets`) from `Timeline` down to `SceneLayers` so each scene knows which overlays target it.

## 5. Rendering: PIP audio

- [x] 5.1 Create a small helper (alongside `audioSpans.ts`, e.g. `overlayAudioSpans.ts`, or extend `audioSpans.ts` with a second exported function — match whichever reads more naturally given the final shape of `audioSpans.ts`) that derives one audio span per `overlays[]` entry with `audio: "own"`, using that overlay's target scene's `from`/`durationInFrames` (from the same `withOffsets` computation `Timeline` already does).
- [x] 5.2 Update `Timeline`'s render to output one additional `<Audio>` `<Sequence>` per own-audio overlay span, independent of (rendered alongside, not merged with) the existing A-roll-continuity audio spans.

## 6. Rendering tests

- [x] 6.1 Write/extend `packages/core/test/rendering/render.test.ts` covering every new/changed scenario in `specs/video-rendering/spec.md`: PIP bubble visible during its scene (pixel-region probe, reusing `getPixelAtRegion`, distinguishing bubble content from the base scene behind it — similar technique to the existing logo/frame tests); default vs. overridden `position`; `circle` vs. `rounded_square` `shape` (corner-region probe: a `rounded_square`'s corner is closer to the base scene's color than a `circle`'s, since a circle clips more aggressively at its bounding box's corners); default vs. overridden `size`; multiple overlays on the same scene both visible; own-audio PIP audible during its scene (reusing `getMeanVolumeDb`); muted PIP silent; own-audio PIP audible simultaneously with an inherited A-roll-continuity B-roll audio (both present, per the deliberate no-ducking Non-Goal — assert both are audible, not that one suppresses the other).
- [x] 6.2 CRITICAL regression check: all three existing example specs (`spec.json`, `brand-spec.json`, `motion-spec.json` — none declare `overlays`) must still validate and render unchanged.

## 7. Wiring and verification

- [x] 7.1 Add a fourth example Video Specification JSON under `packages/cli/examples/` demonstrating `overlays`/`pip`: at least one scene with a `b_roll` (no preceding `a_roll`) plus a PIP overlay with `audio: "own"` — the actual ScreenStudio pattern this change exists for — and at least one scene showing an overridden `position`/`shape`/`size`.
- [x] 7.2 Update root `CLAUDE.md` / package READMEs to describe `overlays`/`pip` and the `pipStyle` brand token, and mark Phase 3 (Responsive Layout) fully complete in the build-plan list.
- [x] 7.3 Run lint, typecheck, and the full test suite (including the rendering tests) across all workspaces; fix anything red before this change is ready to sync/archive. Confirm all three prior example specs still validate and render unchanged.

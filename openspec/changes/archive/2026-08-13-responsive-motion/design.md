## Context

`foundation` and `brand-system` render every scene identically regardless of format: `object-fit: cover`, centered, no motion. See proposal.md for why that's insufficient; see the three delta specs under `specs/` for the exact behavior contracts this design implements. This is the first of two sequential Phase 3 changes — `overlays-pip` (PIP/webcam-bubble) follows this one, not alongside it.

## Goals / Non-Goals

**Goals:**

- Semantic motion (`horizontal_pan`/`vertical_pan`/`zoom`/`static` + optional `focalPoint`) that MotionKit turns into real crop/pan/zoom math, using the source asset's actual dimensions.
- `frame: "phone"` as a second static chrome option alongside `"browser"`, sharing the same engine.
- The `1:1` format, using the same generalized crop/pan/zoom math as the other two formats.

**Non-Goals:**

- No BrowserDemo/PhoneDemo-specific entrance/exit animation — reuses the existing scene-`transition` field.
- No zoom-out (zoom-in toward the focal point only).
- No dual/multi focal points or a pan that sweeps between two distinct focal points — one focal point per scene, this phase.
- No `overlays[]`/PIP — that's `overlays-pip`, the next change.
- No detailed phone bezel — `phoneFrameStyle` mirrors `browserFrameStyle`'s shape (a colored top chrome strip, border-radius, shadow), not a realistic device render.

## Decisions

### 1. Cover-crop-with-a-moving-window: the actual math

Given a source asset's real `(sourceWidth, sourceHeight)` (from probing — decision 2), the target composition's `(targetWidth, targetHeight)`, and a scene's `motion`:

1. Compute the **cover scale**: `scale = max(targetWidth / sourceWidth, targetHeight / sourceHeight)` — the smallest scale where the scaled source fully covers the target frame (standard "object-fit: cover" math, just computed explicitly instead of left to the browser).
2. Compute the **scaled source size**: `scaledWidth = sourceWidth * scale`, `scaledHeight = sourceHeight * scale`. At minimum one of `scaledWidth - targetWidth` or `scaledHeight - targetHeight` is `0` (the covering dimension); the other is the "slack" available to pan across.
3. **`static`**: position the crop window at the focal point (defaulting to center, `{x: 0.5, y: 0.5}`) — `translateX = -(scaledWidth - targetWidth) * focalPoint.x`, `translateY = -(scaledHeight - targetHeight) * focalPoint.y`, clamped to `[-(scaledWidth - targetWidth), 0]` / `[-(scaledHeight - targetHeight), 0]` so the crop never shows past the source's edge. No change over time.
4. **`horizontal_pan`**: `translateY` fixed via the focal point's `y` (same clamped formula as `static`); `translateX` is `interpolate(frame, [0, durationInFrames], [startX, endX])` where `{startX, endX}` are the two clamped extremes of the horizontal slack, ordered by `direction` (`left_to_right` → pan from the left extreme to the right extreme; `right_to_left` → reversed). Symmetric for `vertical_pan` on the Y axis.
5. **`zoom`**: scale itself is `interpolate(frame, [0, durationInFrames], [scale, scale * ZOOM_END_MULTIPLIER])` (a fixed multiplier, e.g. `1.3` — zooming in means the effective crop shrinks toward the focal point over time); translate recomputed each frame from the current (growing) scaled size, anchored to the focal point exactly like `static`.
6. **No `motion` declared**: unchanged existing behavior — `scale`, centered (`focalPoint` defaults to `{0.5, 0.5}`), no interpolation. This is `static` with a centered focal point in every way that matters, so the no-motion path is implemented by literally treating "no motion" as `{ type: "static" }` internally, rather than as a separate code path.

- **Alternative considered**: leave crop math to CSS `object-fit`/`object-position` and only interpolate `object-position`. Rejected — `object-position` percentages don't compose cleanly with a pan's clamped slack range the way explicit `transform: translate() scale()` does, and the zoom case needs scale to change over time regardless.

### 2. Asset dimension probing via `ffprobe`, cached per asset path

`packages/core/src/rendering/probeAssetDimensions.ts` exports `probeAssetDimensions(assetPath): Promise<{ width: number, height: number }>`, shelling out to `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of json <path>` (the same `ffmpeg` toolchain already relied on for test fixtures — see `foundation`'s design.md decision #4). Results are cached in-memory per resolved asset path within a single render (a spec can reference the same asset in multiple scenes; no reason to shell out twice). This only runs during `render()`, never during `validate()` — validation's focal-point/motion checks are pure bounds/enum checks against the spec document itself, not the asset.

- **Alternative considered**: read dimensions via a JS video-parsing library instead of shelling out to `ffprobe`. Rejected — `ffmpeg`/`ffprobe` is already a hard dependency of this toolchain (Remotion's own renderer requires it); adding a second, redundant dependency for the same information is pure overhead.

### 3. `motion` and `frame` are independent scene fields, composed at render time

A scene's `SceneVisual` (from `brand-system`'s `Timeline.tsx`) now always computes a crop transform (motion-driven or the static default) and applies it to the video element; `frame` (when present) wraps the _result_ in chrome, unchanged from `brand-system`'s approach — the two decisions compose without new coupling. `frame: "phone"` adds a second branch next to `frame: "browser"` in the existing `BrowserFrame`-equivalent wrapper, reading `brand.phoneFrameStyle` instead of `brand.browserFrameStyle`, same shape.

### 4. `1:1` is not a special case — the crop math and composition registration are format-agnostic already

Adding `1:1` is: a third `<Composition>` (`MotionKit1x1`, 1080x1080) in `remotion.entry.tsx`, and adding `"1:1"` to `videoFormatSchema`. The crop/pan/zoom math from decision 1 takes `targetWidth`/`targetHeight` as plain parameters — it was written to generalize from day one specifically so a third format is zero-new-math, only a new registration.

### 5. Direction/motion-type mismatch is validated structurally where possible, semantically otherwise

`horizontal_pan`/`vertical_pan` each get their own direction enum at the schema level (discriminated on `motion.type`, mirroring how `aRollSceneSchema`/`bRollSceneSchema` already discriminate on `type`) — so a `zoom` with a `direction` field is a structural validation failure (`MALFORMED_SPEC`), not a separate semantic check. This is stronger and simpler than a semantic cross-field check in `validate.ts`.

## Risks / Trade-offs

- **[Risk] `ffprobe` calls add latency and an external-process dependency to every render.** → Mitigation: per-render, per-asset-path caching (decision 2) means a spec with the same asset reused across scenes only probes once; `ffprobe` is already required by the existing toolchain, so this isn't a new install requirement.
- **[Trade-off] Zoom's end scale is a fixed multiplier (`1.3`), not spec-configurable.** Keeps the schema small per this phase's scope (no "zoom amount" field); revisit if real usage shows `1.3` is wrong for common cases.
- **[Risk] The pan/zoom math is genuinely new and easy to get subtly wrong (off-by-one clamping, wrong axis on vertical pan, direction reversed).** → Mitigation: `tasks.md`'s test plan includes explicit pixel/region-based rendering assertions (reusing `brand-system`'s `getPixelAtRegion` probe helper) that check _which part_ of a source frame is visible at the start vs. end of a pan, not just "the video rendered" — a wrong-direction bug would otherwise pass a naive "did it render" test.

## Open Questions

None — the crop/pan/zoom formulas, probing strategy, frame/motion composition, and the zoom multiplier are all resolved decisions for this phase.

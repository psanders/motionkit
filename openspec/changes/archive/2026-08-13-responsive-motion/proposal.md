## Why

`foundation` and `brand-system` (both shipped) render scenes as a static, centered `object-fit: cover` — the same visual treatment for a scene regardless of output format. The product brief's actual goal for responsive video is different: a `16:9` browser demo should show most of the interface at scale, while the _same_ scene in `9:16` should intentionally exceed the viewport and pan across it to reveal different parts — semantic intent from the AI, with MotionKit computing the real crop/pan/zoom math. This is Phase 3's core capability, split into two sequential changes; this one (`responsive-motion`) covers the motion/crop/zoom engine, phone-frame chrome, and the `1:1` format. The webcam-bubble/PIP capability is a separate follow-up change (`overlays-pip`) that comes after this one ships.

## What Changes

- Add a scene-level `motion` field: `{ type: "horizontal_pan" | "vertical_pan" | "zoom" | "static", direction?, focalPoint?: { x, y } }` — semantic pan/zoom/crop intent, not pixel math. Usable on any `a_roll`/`b_roll` scene, independent of whether `frame` is set (e.g. panning across a plain full-bleed screen recording is valid too).
- Extend the existing `frame` field from `"browser"`-only to `"browser" | "phone"` — phone-shaped chrome as a second static frame decoration, reusing the same crop/pan/zoom engine and the same field (this is `PhoneDemo`; no separate mechanism).
- Add the `1:1` (1080x1080) output format alongside the existing `16:9`/`9:16`.
- Add real source-asset dimension probing (via `ffprobe`) so crop/pan/zoom math has actual source width/height to work with — nothing today reads a source asset's real dimensions.
- Implement the actual "cover crop with a moving window" render math: scale the source to cover the target composition, then `interpolate()` a pan (translateX/translateY) or zoom (scale) over the scene's duration, anchored/biased by the focal point when given.
- Add a `phoneFrameStyle` brand token (same shape as the existing `browserFrameStyle`: `chromeColor`, `chromeHeightPx`, `borderRadius`, `shadow`) — a simplified phone chrome, not a detailed device bezel.

## Capabilities

### New Capabilities

(none — this change is entirely new fields and behavior on the existing scene/spec/brand model, not a new independent resource)

### Modified Capabilities

- `video-spec`: add the `motion` field; expand the `frame` enum to include `"phone"`; expand the `format` enum to include `"1:1"`.
- `video-validation`: validate `motion.type`/`direction` combinations and `focalPoint` bounds (0–1); validate `frame` against the expanded enum; validate `format` against the expanded enum. Stays synchronous — no real asset dimensions needed for validation, only for rendering.
- `video-rendering`: the actual crop/pan/zoom computation and asset-dimension probing; phone-frame rendering; the third `1:1` composition; generalize the existing static object-fit-cover behavior into the focal-point-aware, motion-aware version.
- `brand-system`: add the `phoneFrameStyle` token.

## Impact

- **`packages/core`**: new `src/rendering/probeAssetDimensions.ts` (ffprobe-based), new crop/pan/zoom math module, extended `video-spec/schema.ts` (motion field, expanded frame/format enums), extended `validation/validate.ts` (motion/frame/format checks), extended `brand/schema.ts` (`phoneFrameStyle`), extended `rendering/Timeline.tsx`/`remotion.entry.tsx` (phone frame, third composition, motion-aware rendering replacing the current flat `object-fit: cover`).
- **`packages/cli`**: no command surface changes.
- **No changes** to `packages/mcp` (Phase 4) or to the `overlays[]`/PIP capability (the separate, subsequent `overlays-pip` change).
- **Explicitly out of scope, already decided**: no BrowserDemo/PhoneDemo-specific entrance/exit animation (reuses the existing scene-`transition` field); zoom-out (zoom-in only); dual/multi focal points or a pan that sweeps between two distinct focal points (a single focal point only, this phase).

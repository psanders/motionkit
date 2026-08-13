## Why

`responsive-motion` (shipped) closed out crop/pan/zoom, phone frame, and the `1:1` format — but MotionKit still can't produce the single most common "creator" video pattern: a talking-head webcam bubble layered over a full-frame screen recording (the ScreenStudio look). Every scene today has exactly one visual source; there's no way to show two simultaneously. This change adds MotionKit's first real "layers" primitive — a scene-anchored `overlays[]` array, with `pip` as its first (and only, this phase) overlay type — closing out Phase 3.

## What Changes

- Add an optional top-level `overlays` array to the Video Specification (sibling to `scenes`, not nested inside them).
- Add the `pip` overlay type: `{ type: "pip", sceneIndex, asset, position?, shape?, size?, audio }` — a video bubble anchored to one scene, rendered on top of that scene's existing layers (caption/frame/logo).
  - `position` reuses the existing `Placement` enum (the same one `logo` uses), defaulting to the brand's new `pipStyle.defaultPosition`.
  - `shape` (`"circle"` | `"rounded_square"`) defaults to `"circle"`.
  - `size` (`"sm"` | `"md"` | `"lg"`) defaults to `"md"`, mapped to real pixels via the brand's new `pipStyle.size` scale.
  - `audio` (`"own"` | `"muted"`) is required — extends the same vocabulary `b_roll.audio` already uses, with `"own"` covering the common case of no separate A-roll at all, just a continuous B-roll with a narrating bubble.
- Add a `pipStyle` brand token (`size` scale, `borderWidth`, `borderColor`, `shadow`, `defaultPosition`) so the bubble's visual styling comes from the brand, not the renderer.

## Capabilities

### New Capabilities

(none — `overlays`/`pip` are new fields and behavior on the existing Video Specification and Brand documents, not a new independent resource the way `brand-system` was)

### Modified Capabilities

- `video-spec`: add the top-level `overlays` array and the `pip` overlay type.
- `video-validation`: validate `sceneIndex` resolves to an existing scene (semantic — collected alongside other violations, not a structural short-circuit); validate the overlay's `asset` exists on disk (reusing the existing asset-existence-with-suggestions check); validate `position` against the placement enum (the same dedicated treatment `logo`'s position already gets).
- `video-rendering`: render each scene's matching overlay(s) as an absolutely-positioned, shape-clipped video bubble on top of that scene's existing composed layers, styled from the resolved brand's `pipStyle`; play the overlay's own audio for the scene's duration when `audio: "own"`.
- `brand-system`: add the `pipStyle` token.

## Impact

- **`packages/core`**: extends `src/video-spec/schema.ts` (new `overlaySchema`/`pipOverlaySchema`, top-level `overlays` field), `src/validation/validate.ts` (sceneIndex bounds, overlay asset existence, position checks), `src/brand/schema.ts` (`pipStyle`), and `src/rendering/Timeline.tsx` (bubble rendering layer + own-audio layering, additive alongside the existing per-scene layers and the existing A-roll-continuity audio spans).
- **`packages/cli`**: no command surface changes.
- **No changes** to `packages/mcp` (Phase 4).
- **Explicitly out of scope, already decided**: motion/pan/zoom applied to a PIP itself (fixed cover-scaled bubble, this phase); an animated bubble-to-fullscreen morph (a cut between a bubble-mode scene and a plain fullscreen `a_roll` scene already covers this with zero new code); any overlay type besides `pip`; free-floating/absolute-time overlays (scene-anchored only).

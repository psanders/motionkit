## Context

`foundation`, `brand-system`, and `responsive-motion` (all shipped) give every scene exactly one visual source. See proposal.md for why that's the last real gap before Phase 3 closes; see the delta specs under `specs/` for the exact behavior contracts this design implements.

## Goals / Non-Goals

**Goals:**

- A scene-anchored `overlays[]` array — MotionKit's first real "layers" primitive — with `pip` as its first overlay type.
- The talking-head-bubble-over-screen-recording pattern, including the no-separate-A-roll case (PIP's own audio drives the scene).

**Non-Goals:**

- No pan/zoom/crop applied to a PIP itself — it's a fixed, cover-scaled bubble this phase.
- No animated bubble-to-fullscreen morph — already covered by cutting between a bubble-mode scene and a plain fullscreen `a_roll` scene, no new mechanism needed.
- No overlay type besides `pip` — `overlays[]`'s shape is deliberately general (a discriminated union on `type`, mirroring `sceneSchema`/`motionSchema`) so a future music-bed or independent-caption overlay type slots in later without changing the array's own shape, but only `pip` ships now.
- No free-floating/absolute-time overlays — scene-anchored only.
- No automatic audio ducking/mixing between a PIP's own audio and its scene's existing A-roll-continuity audio — if both are present, they simply play simultaneously; avoiding unwanted overlap (e.g. muting the B-roll's inherited audio) is the spec author's responsibility.

## Decisions

### 1. `overlaySchema` is a discriminated union on `type`, exactly like `sceneSchema`/`motionSchema`

`packages/core/src/video-spec/schema.ts` gets `pipOverlaySchema` (`type: z.literal("pip")`, `sceneIndex: z.number().int().nonnegative()`, `asset: z.string().min(1)`, `position: placementSchema.optional()`, `shape: z.enum(["circle", "rounded_square"]).default("circle")`, `size: z.enum(["sm", "md", "lg"]).default("md")`, `audio: z.enum(["own", "muted"])` — no default, required per proposal.md) and `overlaySchema = z.discriminatedUnion("type", [pipOverlaySchema])`. `videoSpecSchema` gains `overlays: z.array(overlaySchema).optional()`. Following the same established pattern keeps this consistent with every other multi-variant field in the schema rather than inventing new shape conventions.

### 2. `sceneIndex` bounds checking is semantic, not structural — same reasoning as `foundation`'s duration check

`scenes.length` isn't known to a single field's schema in isolation; validating it against `overlays[].sceneIndex` needs the whole parsed document. Rather than a `.check()` refinement on `videoSpecSchema` (which would short-circuit before other semantic checks run), this is a `collectSemanticErrors` check in `validate.ts`, alongside asset existence and duration — so an overlay with both a bad `sceneIndex` and a missing `asset` gets both violations reported together, consistent with `foundation`'s original "collect everything, don't short-circuit" design.

### 3. Overlay asset existence reuses the exact same `checkAssetExists` helper scene assets already use

No parallel implementation — `collectSemanticErrors` calls the existing helper once per scene asset (as today) and once per overlay asset (new), both resolved relative to `specDir` (an overlay's `asset` is spec content, not brand content — unlike a brand's logo, which resolves relative to the _brand's_ directory since brands are shared across specs; a PIP overlay belongs to one spec, so it resolves the same way scene assets do).

### 4. PIP rendering: an absolutely-positioned, `overflow: hidden` bubble layered after the scene's existing layers

In `Timeline.tsx`, `SceneLayers` gains a fourth optional layer (after frame/caption/logo, none of which change): for each `overlays[]` entry whose `sceneIndex` matches the current scene, render a fixed-size `div` (dimensions from `brand.pipStyle.size[overlay.size]`, `border-radius: 50%` for `circle` or a fixed radius for `rounded_square`, `border`/`box-shadow` from `brand.pipStyle.borderWidth`/`borderColor`/`shadow`) positioned via the same `POSITION_STYLES` map `LogoOverlay` already uses (reused directly, not duplicated), containing the overlay's `asset` as an `<OffthreadVideo>` with `object-fit: cover` filling the bubble — no crop-transform math needed here since a fixed circular/rounded-square bubble showing a cover-scaled video has no pan/zoom to resolve (see Non-Goals).

### 5. PIP "own" audio is a new, independent `<Sequence>`/`<Audio>` per overlay, additive to `audioSpans.ts`'s existing output

`Timeline.tsx`'s `Timeline` component already renders one `<Sequence>` per `audioSpans.ts`-derived A-roll-continuity span. PIP audio is a second, independent list: for every `overlays[]` entry with `audio: "own"`, render one more `<Audio>` `<Sequence>` spanning that overlay's target scene's frame range (using the same `from`/`durationInFrames` the scene's own `<Sequence>` uses). These two audio-span lists are computed and rendered independently — neither knows about the other, which is exactly what produces the "simultaneous, no automatic mixing" behavior called out in Non-Goals.

### 6. `pipStyle` mirrors `browserFrameStyle`/`phoneFrameStyle`'s "brand supplies the token, component supplies the structure" pattern

`packages/core/src/brand/schema.ts` gets `pipStyleSchema`: `size` (a `scaleSchema` — the same `{ sm, md, lg }` shape `spacing`/`borderRadius` already use, values in px), `borderWidth` (px), `borderColor`, `shadow` (CSS `box-shadow`, same convention as `shadowsSchema`), `defaultPosition` (`placementSchema`, the same enum `logo.defaultPosition` uses). Both shipped brand files (`default.brand.json`, `acme.brand.json`) need this new required field, same as `phoneFrameStyle` needed adding in `responsive-motion`.

## Risks / Trade-offs

- **[Risk] Simultaneous PIP-own-audio and inherited B-roll audio could double up unexpectedly if an author forgets to mute one.** → Mitigation: this is a deliberate Non-Goal (no automatic ducking), documented here and in the spec itself; the common case (no A-roll at all, just B-roll + PIP) naturally has nothing to double up with, since `audioSpans.ts` produces silence for a B-roll with no preceding A-roll.
- **[Trade-off] A PIP bubble has no motion of its own this phase.** Consistent with keeping this change's scope to the "layers" primitive itself rather than compounding it with per-overlay crop/pan/zoom — revisit if real usage wants an animated or panning bubble.

## Open Questions

None — the schema shape, sceneIndex/asset validation placement, rendering composition order, and audio layering approach are all resolved decisions for this phase.

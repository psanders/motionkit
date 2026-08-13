## Context

`foundation` (shipped) gave MotionKit a Video Specification, a non-throwing multi-error validator, and a Remotion render pipeline for `a_roll`/`b_roll` scenes with one `fade` transition — no visual identity at all. See proposal.md for why Brand exists now; see the four delta specs under `specs/` for the exact behavior contracts this design implements. This design also directly answers a question raised during `foundation`'s review: whether brand configuration should live inside the Video Specification or as its own referenced-by-id resource — it's the latter, and this is where that gets made concrete.

## Goals / Non-Goals

**Goals:**

- Brand is a design-token document that lives in its own file, referenced by id, never inlined into a Video Specification — so the same spec structure (and the same natural-language workflow) works across different products by swapping which brand it resolves to.
- Wire captions, a static browser-frame decoration, a logo overlay, and three new transition types into the existing render pipeline, all reading their visual parameters from the resolved brand.

**Non-Goals:**

- No `BrowserDemo`/`PhoneDemo` pan/zoom/crop/focal-point motion (Phase 3) — `frame: "browser"` in this phase is a static decorative wrapper only.
- No lower-third or CTA _scene types_ — `lowerThirdStyle` and `ctaStyle` are defined in the Brand schema now (per the product brief's brand-token list) but nothing renders them yet; they're validated and loaded, not consumed, until a later phase adds those primitives. This is a stated scope boundary, not an oversight.
- No per-scene caption _position_ override — caption position comes entirely from the brand in this phase; scene-level override (like logo's) is a natural follow-up, not needed yet.
- No brand _editing_ tools or UI — brands are hand-authored JSON files.

## Decisions

### 1. Brand files resolve like assets: spec-directory-first, package-built-in fallback

A brand id resolves by checking `<specDir>/brands/<id>.brand.json` first, then falling back to a package-built-in brands directory (`packages/core/src/brand/brands/<id>.brand.json`, which ships exactly one file: `default.brand.json`). This mirrors `foundation`'s existing asset-resolution pattern (resolved relative to the spec's directory, not cwd) and is what actually satisfies "tailor to different products": a downstream project drops its own `brands/acme.brand.json` next to its specs and writes `"brand": "acme"` — no fork of MotionKit required. Only `"default"` needs to resolve with zero setup, which the package-built-in fallback guarantees.

- **Alternative considered**: a single fixed built-in-only brands directory. Rejected — it would mean every real brand has to be vendored into `@motionkit/core` itself, defeating the "separate file, swappable per product" goal that motivated this change in the first place.
- **Alternative considered**: an env var / config-file-specified brand search path. Rejected for now as unnecessary indirection — the spec-directory convention already gives every spec a natural place to keep its brands, with no extra configuration step.

### 2. Brand schema and registry: same shape as `foundation`'s validate()/render() split

`packages/core/src/brand/schema.ts` defines `brandSchema` (Zod) with required token categories: `colors` (primary/secondary/background/text/accent), `typography` (`fontFamily` + a size scale for title/subtitle/caption/cta), `logo` (`asset` path + `defaultPosition`), `spacing` (sm/md/lg), `borderRadius` (sm/md/lg), `shadows` (sm/md/lg, as CSS `box-shadow` strings — Remotion renders through React/CSS, so this is the natural representation), `captionStyle`, `titleStyle`, `lowerThirdStyle`, `browserFrameStyle`, `ctaStyle`, and `defaultTransitionDurationSeconds`. `packages/core/src/brand/registry.ts` exposes two functions, deliberately split the same way `foundation` split `validate()` (non-throwing) from `render()` (throwing):

- `findBrand(id, specDir): { found: true, brand: Brand, brandDir: string } | { found: false, availableIds: string[] }` — non-throwing, used by `validate()` to produce the `BRAND_NOT_FOUND` structured error with suggestions (`availableIds` comes from listing both resolution locations' `*.brand.json` files).
- `loadBrand(id, specDir): { brand: Brand, brandDir: string }` — throws if not found; used by `render()`, which only runs after `validate()` has already confirmed the brand resolves.
- **Placement enum** (`top_left`, `top_right`, `bottom_left`, `bottom_right`, `center`) is shared by the logo's `defaultPosition` (brand-level) and a scene's `logo.position` override — one enum, defined once in `brand/schema.ts`, imported by `video-spec/schema.ts`.

### 3. Brand asset paths (the logo) resolve relative to the brand file's own directory

The logo's `asset` path resolves relative to `brandDir` (wherever `<id>.brand.json` actually lives — spec-directory or package-built-in), not relative to the video spec's directory. A brand is meant to be reused across many specs in different locations; anchoring its own assets to whichever spec happens to reference it would break the moment a second spec in a different directory used the same brand.

### 4. Captions, browser-frame, and logo are additive layers in `Timeline.tsx`, not new scene types

All three render as extra layers within a scene's existing `<Sequence>`, not as new top-level scene kinds — they decorate an `a_roll`/`b_roll` scene rather than replacing it:

- **Caption**: an `<AbsoluteFill>` text overlay rendered on top of the scene's video, positioned and styled entirely from `brand.captionStyle` (no scene-level position override in this phase — see Non-Goals).
- **Browser frame**: when `scene.frame === "browser"`, the scene's video is rendered inside a wrapper `<div>` styled from `brand.browserFrameStyle` (a colored top chrome bar, border-radius, shadow) — pure CSS/JSX, no interpolation, no motion.
- **Logo**: an `<Img>` of the resolved brand's logo asset, absolutely positioned per `scene.logo.position ?? brand.logo.defaultPosition`, rendered for that scene's full duration.

### 5. Three new transitions, same `interpolate()` approach as `fade` — no new dependency yet

`slide-left`/`slide-right` drive a `translateX` `interpolate()` over the transition window; `zoom` drives a `scale` `interpolate()`. Same fixed-frame-window technique `foundation`'s design established for `fade`, still no `@remotion/transitions` dependency — these are all single-scene entrance effects, not cross-fades between two simultaneously-visible sources, so plain `interpolate()` continues to be sufficient. Revisit `@remotion/transitions` if a later phase needs true cross-scene compositing (e.g., overlapping two videos mid-transition) rather than one scene's entrance effect.

- The transition window's duration is now `scene.transition?.duration ?? resolvedBrand.defaultTransitionDurationSeconds`, converted to frames via `spec.fps` — resolved once per scene during the same up-front pass that already computes audio spans (`foundation`'s `audioSpans.ts` pattern), not per-frame.

### 6. Validation gains brand/caption/frame/logo checks, still collected (never fail-fast)

`validate()` calls `findBrand()` once per specification and adds a `BRAND_NOT_FOUND` error (with `availableIds` as suggestions) if it fails; caption/frame/logo field checks (non-empty caption, supported frame value, supported logo position) run alongside the existing semantic checks and are collected into the same multi-error result `foundation` established — no change to the non-throwing, multi-violation validation model.

## Risks / Trade-offs

- **[Risk] Two-location brand resolution (spec-dir-first, then built-in) could surprise someone who expects a single lookup path.** → Mitigation: the `BRAND_NOT_FOUND` error's `availableIds` suggestions list brands from both locations, and `findBrand`'s result carries which directory it actually resolved from, so `render()`/the CLI can report it plainly.
- **[Trade-off] `lowerThirdStyle`/`ctaStyle` are validated and loaded but unused by rendering this phase.** Accepted per the product brief's brand-token list (section 8) rather than leaving Brand's schema incomplete and having to make a breaking change to it when lower-third/CTA scene types land later.
- **[Risk] Adding a required `brands/default.brand.json` package asset changes `@motionkit/core`'s build/publish surface (a non-`.ts` file needs to ship in `dist/`).** → Mitigation: copy the `brands/` directory into `dist/` as part of the package's existing build step (a small addition to `packages/core`'s build config), verified by a test that resolves `"default"` from the built package output, not just from `src/`.

## Open Questions

None — brand resolution order, asset-path anchoring, the additive-layer rendering approach, and the transition-duration resolution rule above are all resolved decisions for this phase.

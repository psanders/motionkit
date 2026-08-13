## Why

Phase 1 (`foundation`, shipped) proved the core engine — a Video Specification renders deterministically via Remotion — but every video looks the same: no colors, no typography, no logo, no captions, nothing that makes a video recognizably _this product's_. Per the phased build plan in `CLAUDE.md`, Phase 2 (Design System) is next: introduce a first-class Brand system so the same Video Specification, and the same natural-language workflow, can be visually tailored to different products by swapping which brand it references — without inlining design decisions into every spec.

## What Changes

- Add a Brand system: a Brand is a design-token document (colors, typography scale, logo, spacing scale, border-radius scale, shadow presets, caption style, title style, lower-third style, browser-frame style, CTA style, default transition duration) living in its own file per brand, never inlined into a Video Specification. Ship one built-in `default` brand.
- Add an optional `brand` field to the Video Specification (a brand id, defaults to `"default"` when omitted).
- Add a scene-level `caption` field: optional text rendered as a styled overlay for that scene's duration, styled per the active brand's caption tokens.
- Add a scene-level `frame` field: optional static browser-chrome decoration (`frame: "browser"`) styled per the active brand's browser-frame tokens (color/border-radius/shadow only — no pan/zoom/crop/focal-point motion; that's Phase 3's `BrowserDemo` work).
- Add a scene-level `logo` field: optionally overlays the active brand's logo on that scene, using the brand's default placement unless overridden.
- **BREAKING**: expand the transition vocabulary from `{ fade }` to `{ fade, slide-left, slide-right, zoom }`. Existing specs using only `fade` keep working unchanged; the schema's transition enum itself changes, so anything that structurally depended on `fade` being the _only_ valid value (e.g. exhaustiveness assumptions in calling code) would need updating — no such calling code exists outside this repo yet.
- A scene's `transition` may omit an explicit duration and inherit the active brand's default transition duration.

## Capabilities

### New Capabilities

- `brand-system`: the Brand schema, the one-file-per-brand convention, and a brand registry/loader that resolves a brand id to its parsed, validated Brand document.

### Modified Capabilities

- `video-spec`: add the optional `brand` field to the Video Specification document; add optional `caption`, `frame`, and `logo` fields to scenes; expand the transition `type` enum to include `slide-left`, `slide-right`, and `zoom`; allow a transition to omit its duration.
- `video-validation`: validate that a specified `brand` id resolves to a known brand (reporting available brand ids as suggestions on a miss, mirroring the existing missing-asset-suggestions behavior); validate the new `caption`/`frame`/`logo` fields; validate against the expanded transition set.
- `video-rendering`: render captions, the browser-frame decoration, and the logo overlay, all styled from the resolved brand's tokens; render the three new transition types; apply the brand's default transition duration when a scene's transition doesn't specify one.

## Impact

- **`packages/core`**: new `src/brand/` (schema, types, registry/loader) and one shipped brand definition (`brands/default.brand.json` or equivalent, exact location decided in design.md). Extends `src/video-spec/schema.ts` (new fields, expanded transition enum), `src/validation/validate.ts` (new checks), and `src/rendering/` (caption/frame/logo rendering, new transition implementations, brand resolution wired into the render pipeline).
- **`packages/cli`**: no command surface changes — `validate`/`render` keep working as-is against specs with or without `brand`; validation/render errors now can also include brand-related structured errors.
- **No changes** to `packages/mcp` (Phase 4) or to `BrowserDemo`'s actual pan/zoom/crop/focal-point motion or `PhoneDemo` (Phase 3) — those are untouched by this change.
- **Out of scope**: the picture-in-picture / webcam-bubble layering capability discussed after `foundation` shipped is not part of this change — it isn't yet assigned to a phase.

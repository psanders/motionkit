## 1. Brand schema and built-in default brand

- [x] 1.1 Create `packages/core/src/brand/schema.ts`: `placementSchema` enum (`top_left`, `top_right`, `bottom_left`, `bottom_right`, `center`) and `brandSchema` (Zod) with required `colors`, `typography`, `logo` (`asset` + `defaultPosition`), `spacing`, `borderRadius`, `shadows`, `captionStyle`, `titleStyle`, `lowerThirdStyle`, `browserFrameStyle`, `ctaStyle`, `defaultTransitionDurationSeconds`.
- [x] 1.2 Create `packages/core/src/brand/types.ts` re-exporting inferred types (`Brand`, `Placement`).
- [x] 1.3 Create `packages/core/src/brand/brands/default.brand.json`: the built-in `default` brand, satisfying every required token category with reasonable values (e.g. a neutral color palette, a system font stack, a simple logo placeholder asset).
- [x] 1.4 Update `packages/core`'s build config so `src/brand/brands/**/*.json` is copied into `dist/brand/brands/` (non-TS assets don't get emitted by `tsc`).
- [x] 1.5 Write `packages/core/test/brand/schema.test.ts` covering: well-formed brand document accepted, missing required token category rejected (per `specs/brand-system/spec.md`).

## 2. Brand registry

- [x] 2.1 Create `packages/core/src/brand/registry.ts`: `findBrand(id, specDir)` — non-throwing, checks `<specDir>/brands/<id>.brand.json` then the package's built-in `brands/` directory, returns `{ found: true, brand, brandDir }` or `{ found: false, availableIds }` (availableIds collected from both locations' `*.brand.json` files).
- [x] 2.2 Add `loadBrand(id, specDir)` to the same module: throwing wrapper over `findBrand` for use after validation has already confirmed the brand resolves.
- [x] 2.3 Create `packages/core/src/brand/index.ts` barrel export.
- [x] 2.4 Write `packages/core/test/brand/registry.test.ts` covering: known id resolves (from both a spec-dir brand and the built-in default), unknown id reports available ids without throwing, `loadBrand` throws on an unknown id (per `specs/brand-system/spec.md`).

## 3. Video Specification schema changes

- [x] 3.1 Update `packages/core/src/video-spec/schema.ts`: add optional top-level `brand` (string, default `"default"`); expand `transitionSchema`'s `type` enum to `fade`/`slide-left`/`slide-right`/`zoom`; make `transitionSchema.duration` optional; add optional `caption` (non-empty-checked at the validation layer, not structurally — schema just requires `z.string()`, consistent with how `foundation` deferred the "positive duration" semantic check out of the structural schema); add optional `frame` (`z.literal("browser")` for now, ready to extend the enum later); add optional `logo` (`z.literal(true)` or `{ position: placementSchema }`, imported from `../brand/schema.js`).
- [x] 3.2 Update `packages/core/src/video-spec/types.ts` to re-export the new/changed inferred types.
- [x] 3.3 Update `packages/core/test/video-spec/schema.test.ts` (extend, don't replace) covering every new/changed scenario in `specs/video-spec/spec.md`: brand id accepted / omitted-defaults-to-default, caption accepted / optional, browser frame accepted / unrecognized-frame-rejected, logo accepted with default and overridden placement, all four transition types accepted, unrecognized transition type still rejected, transition duration now optional.

## 4. Validation changes

- [x] 4.1 Update `packages/core/src/validation/errors.ts`: add error codes `BRAND_NOT_FOUND`, `EMPTY_CAPTION`, `UNSUPPORTED_FRAME`, `UNSUPPORTED_LOGO_POSITION`.
- [x] 4.2 Update `packages/core/src/validation/validate.ts`: call `findBrand()` once per specification, add `BRAND_NOT_FOUND` (with `availableIds` as suggestions) on a miss; add semantic checks for non-empty `caption`, supported `frame` value, and supported `logo.position`, collected alongside existing checks (never fail-fast, per `foundation`'s established model); update the transition-type check to validate against the expanded set.
- [x] 4.3 Update `packages/core/test/validation/validate.test.ts` (extend) covering every new/changed scenario in `specs/video-validation/spec.md`: unknown brand reported with suggestions, empty caption rejected, unsupported frame rejected, unsupported logo position rejected, expanded transition set enforced, multiple new-and-old violations still all reported together.

## 5. Rendering changes

- [x] 5.1 Update `packages/core/src/rendering/render.ts`: resolve the spec's brand via `loadBrand()` after `validate()` succeeds; pass the resolved `Brand` into the composition's `inputProps` alongside the spec.
- [x] 5.2 Update `packages/core/src/rendering/Timeline.tsx`: accept the resolved brand as a prop; render a caption overlay (styled via `brand.captionStyle`) when `scene.caption` is set; wrap scene content in a browser-chrome frame (styled via `brand.browserFrameStyle`) when `scene.frame === "browser"`; render the brand's logo (`<Img>`, positioned via `scene.logo.position ?? brand.logo.defaultPosition`) when `scene.logo` is set.
- [x] 5.3 Extend the transition window computation (alongside `audioSpans.ts`'s pattern) to resolve each transitioning scene's actual duration as `scene.transition.duration ?? brand.defaultTransitionDurationSeconds`, in frames.
- [x] 5.4 Implement `slide-left`/`slide-right` (`translateX` `interpolate()`) and `zoom` (`scale` `interpolate()`) transitions alongside the existing `fade` opacity interpolation.
- [x] 5.5 Write/extend `packages/core/test/rendering/render.test.ts` covering every new/changed scenario in `specs/video-rendering/spec.md`: caption visible during its scene, browser frame visible, logo visible at default and overridden placement, all three new transition types render distinctly from a hard cut, brand-default transition duration is honored when a scene doesn't specify one, and the existing `fade` scenario still passes unchanged.

## 6. Wiring and verification

- [x] 6.1 Add a second example Video Specification JSON under `packages/cli/examples/` demonstrating brand/caption/frame/logo/new-transition usage (in addition to the existing Phase 1 example, which must keep working unchanged since `brand` defaults to `"default"`).
- [x] 6.2 Update root `CLAUDE.md` / package READMEs to describe the brand system, the new scene fields, and the expanded transition set.
- [x] 6.3 Run lint, typecheck, and the full test suite (including the rendering tests) across all workspaces; fix anything red before this change is ready to sync/archive. Confirm the existing Phase 1 example spec (no `brand` field) still validates and renders unchanged.

# MotionKit

A programmable, branded video engine exposed through MCP. An AI agent describes a video in
natural language, an agent layer turns that into a structured, versioned Video Specification
(Zod schema), and MotionKit validates and renders it deterministically via Remotion.

The video engine ships in phases via OpenSpec changes (see `CLAUDE.md` for the build plan and
`openspec/` for specs/proposals). Phase 1 (Foundation) is in: a versioned Video Specification
schema, a non-throwing structured-error validator, and a deterministic Remotion render pipeline
for the `16:9`/`9:16` formats, with `motionkit validate`/`motionkit render` CLI commands driving
them. Phase 2 (Brand System) adds a Brand system — a design-token document (colors, typography,
logo, spacing, shadows, and per-primitive style presets) referenced by id and never inlined into
a Video Specification — plus scene-level `caption`, `frame`, and `logo` fields, and three new
transitions (`slide-left`, `slide-right`, `zoom`) alongside the existing `fade`. Phase 3a
(Responsive Motion) adds a scene-level `motion` field (`horizontal_pan`/`vertical_pan`/`zoom`/
`static`, with an optional focal point) that drives real crop/pan/zoom render math based on each
source asset's actual dimensions, a `frame: "phone"` chrome decoration alongside `"browser"`,
and the `1:1` format. Phase 3b (Overlays / PIP) adds a scene-anchored `overlays` array — a video
bubble (`pip`) rendered on top of its target scene, with a required `audio: "own" | "muted"` mode
covering the common "no separate A-roll, just a narrating webcam bubble over B-roll" pattern —
closing out Phase 3. Phase 4 (MCP tool surface) is next.

## Packages

- `packages/core` (`@motionkit/core`) — shared Zod schemas, types, error classes, utils, and the
  MotionKit engine: the Brand schema and registry (`src/brand/`), the Video Specification schema
  (`src/video-spec/`), its validator (`src/validation/`), and the Remotion render pipeline
  (`src/rendering/`).
- `packages/mcp` (`@motionkit/mcp`) — the MCP server AI agents talk to (still a placeholder
  `ping` tool — the real tool surface is Phase 4).
- `packages/cli` (`@motionkit/cli`) — an oclif CLI, installable globally from this checkout
  (`npm install -g ./packages/cli`) as the `motionkit` command: `motionkit validate <spec.json>`,
  `motionkit render <spec.json>`, and `motionkit config` to register `@motionkit/mcp` with an
  MCP-aware client. See `packages/cli/examples/` for runnable examples: a Phase 1 spec, a
  brand/caption/frame/logo/transition-demonstrating Phase 2 spec, a motion/phone-frame/
  `1:1`-demonstrating Phase 3a spec, and an overlays/PIP-demonstrating Phase 3b spec.

## Requirements

- Node.js >= 22 (see `.nvmrc`)

## Getting started

```bash
npm install
npm run build
npm run lint
npm run typecheck
npm test
```

`npm install` at the repo root is the only install step — this is an npm workspaces monorepo, so
`packages/cli` and `packages/mcp` automatically get their `@motionkit/core` dependency symlinked
to `packages/core` rather than fetched from a registry.

## Writing a Video Specification

A Video Specification (a `spec.json`) is the structured, versioned document that describes a
video as data — an output format, a frame rate, an ordered timeline of scenes, and optionally a
brand and a set of overlays. It's the contract between the creative/AI layer and MotionKit's
render pipeline. The authoritative shape is the Zod schema at
`packages/core/src/video-spec/schema.ts` (scenes) and `packages/core/src/brand/schema.ts`
(brand tokens) — everything below is grounded in those two files.

### Top-level fields

| Field      | Type                        | Notes                                                                                                  |
| :--------- | :-------------------------- | :----------------------------------------------------------------------------------------------------- |
| `version`  | `"1"`                       | The schema version literal. A future version adds a new literal, not a mutation of this one.           |
| `format`   | `"16:9" \| "9:16" \| "1:1"` | Output aspect ratio.                                                                                   |
| `fps`      | positive number             | Frame rate.                                                                                            |
| `brand`    | string, optional            | A brand id, resolved at validate/render time. Defaults to `"default"` when omitted.                    |
| `scenes`   | array of scenes, min 1      | The ordered timeline. Required.                                                                        |
| `overlays` | array of overlays, optional | Scene-anchored layers rendered on top of the scene timeline — a sibling array, not nested in `scenes`. |

One structural rule lives at the document level rather than per-scene: **the first scene may not
declare a `transition`** — there's nothing before it to transition from.

### Scenes: `a_roll` and `b_roll`

`scenes` is a discriminated union on `type`: `"a_roll"` (primary footage carrying its own audio)
or `"b_roll"` (supporting footage). Both share the same base fields:

| Field        | Type                             | Notes                                                                                                                                                                         |
| :----------- | :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asset`      | non-empty string                 | Path to the source video, resolved relative to the spec's own directory.                                                                                                      |
| `duration`   | number                           | Seconds. Must be positive — enforced semantically by `validate()`, not the schema, so it reports alongside other errors.                                                      |
| `transition` | `{ type, duration? }`, optional  | `type` is one of `fade`, `slide-left`, `slide-right`, `zoom`. `duration` (seconds) is optional — omitted falls back to the active brand's `defaultTransitionDurationSeconds`. |
| `caption`    | string, optional                 | Text overlaid for the scene's duration, styled from the active brand's caption tokens. Must be non-empty if present.                                                          |
| `frame`      | `"browser" \| "phone"`, optional | A static, decorative chrome wrapper around the scene's visual content.                                                                                                        |
| `logo`       | `true \| { position }`, optional | `true` uses the active brand's default logo placement; an object overrides it. `position` is one of `top_left`, `top_right`, `bottom_left`, `bottom_right`, `center`.         |
| `motion`     | discriminated union, optional    | Semantic pan/zoom/crop intent — see below. Omitted = a fixed, centered cover-crop.                                                                                            |

`b_roll` scenes additionally take:

| Field   | Type                    | Notes                                                                                   |
| :------ | :---------------------- | :-------------------------------------------------------------------------------------- |
| `audio` | `"continue" \| "muted"` | Defaults to `"continue"` (keeps playing the preceding A-roll's audio track) if omitted. |

`a_roll` scenes have no `audio` field — they always carry their own audio.

### `motion`: pan/zoom/crop intent

`motion` is a discriminated union on `type`, independent of `frame` (usable with or without one).
Every variant is schema-`.strict()`, so putting a `direction` on `zoom`/`static` (which don't
accept one) is a validation error rather than something silently dropped:

- `{ "type": "horizontal_pan", "direction"?: "left_to_right" | "right_to_left" }` — direction
  defaults to `"left_to_right"`.
- `{ "type": "vertical_pan", "direction"?: "top_to_bottom" | "bottom_to_top" }` — direction
  defaults to `"top_to_bottom"`.
- `{ "type": "zoom" }`
- `{ "type": "static" }`

Every variant also accepts an optional `focalPoint: { x, y }`, normalized `0`–`1` within the
source asset (bounds checked semantically, so an out-of-range value is a reported error, not a
crash) — where a pan biases its crop, or what a `static`/`zoom` centers on. The actual
scale/translate math for a given frame lives in `packages/core/src/rendering/cropTransform.ts`
and uses each asset's real probed dimensions (`probeAssetDimensions.ts`), not just the target
composition's.

### Overlays: the `pip` type

`overlays` is a sibling array to `scenes`, discriminated on `type` (only `"pip"` exists today —
a video bubble, the "webcam-narrating-over-B-roll" pattern). Each overlay is _scene-anchored_, not
time-anchored — it references a scene by index, not an absolute time range:

| Field        | Type                           | Notes                                                                                                                                                                                                                                                                                           |
| :----------- | :----------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sceneIndex` | integer                        | Index into `scenes[]` this overlay renders on top of. Bounds-checked semantically by `validate()`.                                                                                                                                                                                              |
| `asset`      | non-empty string               | Path to the overlay's video, resolved relative to the spec's own directory.                                                                                                                                                                                                                     |
| `position`   | placement, optional            | Defaults to the active brand's `pipStyle.defaultPosition` when omitted.                                                                                                                                                                                                                         |
| `shape`      | `"circle" \| "rounded_square"` | Defaults to `"circle"`.                                                                                                                                                                                                                                                                         |
| `size`       | `"sm" \| "md" \| "lg"`         | Defaults to `"md"`. Mapped to real pixels via the active brand's `pipStyle.size` scale.                                                                                                                                                                                                         |
| `audio`      | `"own" \| "muted"`             | Required. `"own"` plays the overlay's own asset audio (the common case: no separate A-roll at all, just a narrating webcam bubble over continuous B-roll). `"muted"` contributes no audio. There's deliberately no automatic ducking against the scene's own audio if both are present at once. |

### How `brand` resolves

`brand` is just a string id. At validate/render time, `findBrand`/`loadBrand`
(`packages/core/src/brand/registry.ts`) resolve it by checking, in order:

1. `<specDir>/brands/<id>.brand.json` — next to the spec file itself.
2. The package's built-in `packages/core/src/brand/brands/` — which ships exactly one brand,
   `"default"`.

An unresolvable id is a structural `BRAND_NOT_FOUND` validation error listing the ids actually
available in both locations. A brand document (`brandSchema` in
`packages/core/src/brand/schema.ts`) carries: `colors` (`primary`/`secondary`/`background`/
`text`/`accent`), `typography` (`fontFamily` + `sizes.title`/`subtitle`/`caption`/`cta`), `logo`
(`asset` + `defaultPosition` — the logo's `asset` path resolves relative to the _brand file's_
own directory, not the spec's), `spacing`/`borderRadius` (`sm`/`md`/`lg` px scales), `shadows`
(`sm`/`md`/`lg` CSS `box-shadow` strings), `captionStyle`, `browserFrameStyle`,
`phoneFrameStyle`, `pipStyle` (a `size` scale plus `borderWidth`/`borderColor`/`shadow`/
`defaultPosition`), and `defaultTransitionDurationSeconds`. (`titleStyle`, `lowerThirdStyle`, and
`ctaStyle` are validated/loaded too, but nothing renders them yet — no title/lower-third/CTA
scene field exists.) A brand always lives in its own `<id>.brand.json` file — never inlined into
a Video Specification.

### A complete worked example

This composes most of the vocabulary above into one spec: an explicit `acme` brand, a captioned
A-roll opener with a logo, a browser-framed B-roll with a pan and a PIP webcam bubble, a muted
B-roll with a phone frame and a zoom, and a closing A-roll.

```json
{
  "version": "1",
  "format": "16:9",
  "fps": 30,
  "brand": "acme",
  "scenes": [
    {
      "type": "a_roll",
      "asset": "assets/interview.mp4",
      "duration": 3,
      "caption": "Welcome to Acme",
      "logo": true
    },
    {
      "type": "b_roll",
      "asset": "assets/broll-1.mp4",
      "duration": 4,
      "frame": "browser",
      "motion": { "type": "horizontal_pan", "direction": "left_to_right" },
      "transition": { "type": "slide-left" }
    },
    {
      "type": "b_roll",
      "asset": "assets/broll-2.mp4",
      "duration": 3,
      "audio": "muted",
      "frame": "phone",
      "motion": { "type": "zoom", "focalPoint": { "x": 0.5, "y": 0.4 } },
      "caption": "Now in 4K",
      "transition": { "type": "zoom" }
    },
    {
      "type": "a_roll",
      "asset": "assets/interview-2.mp4",
      "duration": 3,
      "logo": { "position": "top_left" },
      "transition": { "type": "slide-right" }
    }
  ],
  "overlays": [
    {
      "type": "pip",
      "sceneIndex": 1,
      "asset": "assets/webcam.mp4",
      "position": "top_right",
      "shape": "rounded_square",
      "size": "lg",
      "audio": "own"
    }
  ]
}
```

Note the first scene declares no `transition` (nothing to transition from), `acme` resolves from
a `brands/acme.brand.json` file that must sit next to this spec, and neither transition here sets
an explicit `duration` — both inherit `acme.brand.json`'s `defaultTransitionDurationSeconds`.

### More examples

Rather than guess at further permutations, read the runnable specs already in the repo — each
is documented (feature-by-feature) in its own README:

- `packages/cli/examples/spec.json` — Phase 1 only: plain `a_roll`/`b_roll` scenes, one `fade`
  transition, no `brand` (implicitly `"default"`).
- `packages/cli/examples/brand-spec.json` — brand resolution, `caption`, `frame: "browser"`,
  both forms of `logo`, and all four transition types.
- `packages/cli/examples/motion-spec.json` — the `1:1` format and all four `motion` types
  (including `frame: "phone"` combined with a `zoom`).
- `packages/cli/examples/overlays-spec.json` — the `overlays` array and the `pip` type, including
  a `b_roll` scene with no A-roll behind it at all (audio carried entirely by an `audio: "own"`
  PIP).
- `demos/fonoster-intro/spec-16x9.json` (and its `spec-9x16.json` sibling) — a full, real-world
  (non-synthetic-asset) spec: A-roll intro → PIP+B-roll → A-roll → PIP+B-roll, real brand colors,
  documented scene-by-scene in `demos/fonoster-intro/README.md`.

`packages/cli/examples/README.md` explains what each example spec is exercising and how to
render it; `packages/cli/examples/generate-assets.sh` synthesizes the placeholder video assets
those examples reference via `ffmpeg`.

## Using the CLI

`packages/cli` (`@motionkit/cli`) is an [oclif](https://oclif.io) CLI wrapping
`@motionkit/core`'s `validate()`/`render()` and the MCP client-registration helper below.

### Install

```bash
npm install
npm run build
npm install -g ./packages/cli
```

`npm install -g ./packages/cli` gives you a `motionkit` command on your `PATH` — install from the
local path (with the leading `./`; a bare `packages/cli` is read as a GitHub shorthand and
fails), not by package name, since `@motionkit/cli` isn't published to the npm registry yet. Run
from the repo root inside this checkout, npm resolves the workspace-linked `@motionkit/core`
dependency automatically and symlinks the global `motionkit` binary straight back to
`packages/cli` — so it always runs whatever's currently built there. Rerun `npm run build` after
pulling changes to pick them up; no need to reinstall.

```bash
motionkit ping
```

If you'd rather not install globally, every command also runs via its built entry point directly:

```bash
node packages/cli/bin/run.js <command> [args] [flags]
```

(this is the pattern `packages/cli/examples/README.md` and `demos/fonoster-intro/README.md` use,
so their commands keep working without a global install.) The rest of this section uses the
global `motionkit` form; substitute either invocation freely.

### Commands

Four commands exist today (`packages/cli/src/commands/`):

- **`motionkit ping`** — health check; confirms the CLI wires up to `@motionkit/core`. No args.

  ```bash
  motionkit ping
  ```

- **`motionkit validate <spec>`** — reads a Video Specification JSON file, runs `@motionkit/core`'s
  `validate()`, and reports structured errors. Exits `0` on success, `1` on failure (scriptable).

  ```bash
  motionkit validate path/to/spec.json
  ```

- **`motionkit render <spec>`** — validates first (so an invalid spec is never rendered, using
  the same `validate()` call and error formatting as `motionkit validate`), then renders to MP4
  via `@motionkit/core`'s `render()`.

  ```bash
  motionkit render path/to/spec.json
  motionkit render path/to/spec.json --output out.mp4
  motionkit render path/to/spec.json -o out.mp4
  ```

  The `--output`/`-o` flag is optional — when omitted, the output MP4 is written alongside the
  spec file, same base name, `.mp4` extension (e.g. `path/to/spec.mp4`).

- **`motionkit config`** — registers the built `@motionkit/mcp` server with an MCP-aware client's
  config file, so the client can launch MotionKit's MCP tools without hand-editing JSON.

  ```bash
  motionkit config
  motionkit config --client claude
  motionkit config --path /custom/config/location.json
  ```

  `--client` defaults to `claude` (Claude Desktop) — the only client supported this phase, though
  the flag exists so more clients can be added later without a breaking CLI change. It resolves
  Claude Desktop's config file per OS (`~/Library/Application Support/Claude/
claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows,
  `~/.config/Claude/claude_desktop_config.json` elsewhere — override with `--path`), merges in an
  `mcpServers.motionkit` entry that launches `packages/mcp/dist/index.js` via `node`, and leaves
  every other key and every other registered server in that file untouched. It refuses to run
  (with a pointer to `npm run build`) if `packages/mcp` hasn't been built yet.

Being an oclif CLI, every command supports `--help`:

```bash
motionkit render --help
```

During active development on the CLI package itself, `packages/cli`'s own `npm run dev` runs the
unbuilt TypeScript directly via `tsx` (watching `src/` and re-executing `bin/dev.js`) — useful
when iterating on the CLI's source, not needed for ordinary day-to-day usage.

## Workflow tooling

- **OpenSpec** — spec-driven development. Specs live in `openspec/specs/`, proposals in
  `openspec/changes/`. Use `/openspec:propose`, `/openspec:apply`, `/openspec:archive`. Scaffolded
  via `npx @fission-ai/openspec@latest init --tools claude`.
- **psstack commands** — this repo's `.claude/settings.json` registers the `psstack` marketplace
  and enables the `ps` plugin, so `/ps:*` commands (e.g. `/ps:ship`, `/ps:kaizen`) are available
  without per-machine setup.

## Scripts

| Script              | Description                                         |
| :------------------ | :-------------------------------------------------- |
| `npm run build`     | `tsc -b` across all workspaces (project references) |
| `npm run lint`      | ESLint (flat config) across the repo                |
| `npm run typecheck` | `tsc -b --force`                                    |
| `npm test`          | mocha unit tests in every package                   |

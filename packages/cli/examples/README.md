# Example Video Specifications

Four small specs for manually smoke-testing `motionkit validate`/`motionkit render` against real
(synthetic) assets, without an MCP client attached.

```bash
cd packages/cli/examples
./generate-assets.sh                          # synthesizes assets/*.mp4 via ffmpeg (gitignored)
node ../bin/run.js validate spec.json
node ../bin/run.js render spec.json           # writes spec.mp4 alongside spec.json

node ../bin/run.js validate brand-spec.json
node ../bin/run.js render brand-spec.json     # writes brand-spec.mp4 alongside brand-spec.json

node ../bin/run.js validate motion-spec.json
node ../bin/run.js render motion-spec.json    # writes motion-spec.mp4 alongside motion-spec.json

node ../bin/run.js validate overlays-spec.json
node ../bin/run.js render overlays-spec.json  # writes overlays-spec.mp4 alongside overlays-spec.json
```

## `spec.json` — Phase 1 (Foundation)

Exercises every Phase 1 primitive: an `a_roll` scene, a `b_roll` scene that defaults to
continuing the preceding A-roll's audio, a `b_roll` scene that's explicitly `"audio": "muted"`
and declares a `fade` transition, and a second `a_roll` scene. It declares no `brand`, so it
implicitly resolves to MotionKit's built-in `"default"` brand — this spec predates the brand
system and is expected to keep validating and rendering exactly as it did in Phase 1.

## `brand-spec.json` — Phase 2 (Brand System)

Exercises every Phase 2 primitive: an explicit `brand` reference (`"acme"`, resolved from
`brands/acme.brand.json` next to this spec — see design.md decision #1's spec-directory-first
resolution), a scene `caption`, a scene `frame: "browser"`, a scene `logo` at both the brand's
default placement (`logo: true`) and an overridden one (`logo: { "position": "top_left" }`),
and all three new transition types (`slide-left`, `slide-right`, `zoom`), none of which specify
an explicit duration — so each inherits `acme.brand.json`'s `defaultTransitionDurationSeconds`.
`brands/acme-logo.svg` is the brand's own logo asset, resolved relative to the brand file's
directory, not this spec's.

## `motion-spec.json` — Phase 3a (Responsive Motion)

Exercises every `responsive-motion` primitive: the `1:1` (1080x1080) format, a `horizontal_pan`
motion (default `left_to_right` direction), a `frame: "phone"` decoration combined with a `zoom`
motion anchored to a centered focal point, a `vertical_pan` motion with an explicit
`bottom_to_top` direction, and a `static` motion biased toward an off-center focal point — all
against the `acme` brand from `brand-spec.json`'s example. Every source asset here is the same
640x360 landscape footage `generate-assets.sh` already produces; the crop/pan/zoom math computes
real slack to move across regardless of target format, using each asset's actual probed
dimensions (see `probeAssetDimensions.ts`), not just the target composition's.

## `overlays-spec.json` — Phase 3b (Overlays / PIP)

Exercises the `overlays-pip` capability — the ScreenStudio-style webcam-bubble pattern. Scene 0
is a `b_roll` with no preceding `a_roll` at all — its own audio-continuity chain produces
silence — paired with an `overlays[]` entry (`type: "pip"`, `audio: "own"`) whose own asset
audio drives the narration for that scene, at the `acme` brand's default PIP placement/shape/
size. Scene 1 is a plain full-screen `a_roll` (no overlay) — the "cut to fullscreen" pattern
discussed and confirmed sufficient in place of an animated bubble-to-fullscreen morph. Scene 2
has a second PIP overlay with every override exercised at once: `position: "top_right"`,
`shape: "rounded_square"`, `size: "lg"`, and `audio: "muted"` (silent, so it doesn't compete with
whatever audio the scene's own chain would otherwise produce).

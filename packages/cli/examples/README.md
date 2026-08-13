# Example Video Specifications

Two small specs for manually smoke-testing `motionkit validate`/`motionkit render` against real
(synthetic) assets, without an MCP client attached.

```bash
cd packages/cli/examples
./generate-assets.sh                          # synthesizes assets/*.mp4 via ffmpeg (gitignored)
node ../bin/run.js validate spec.json
node ../bin/run.js render spec.json           # writes spec.mp4 alongside spec.json

node ../bin/run.js validate brand-spec.json
node ../bin/run.js render brand-spec.json     # writes brand-spec.mp4 alongside brand-spec.json
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

## Why

Every scene and PIP overlay asset today plays from the start of its source file for
exactly `duration` seconds. Reusing one long raw take (a phone recording, a screen
capture) across multiple scenes or as both an A-roll and a PIP overlay currently
requires pre-cutting it into separate files by hand before it can be referenced —
there is no way to point at an in/out range within a single source file. This is
tedious, error-prone (a real demo in this repo shipped with duplicated files instead
of actual trims), and blocks any future automated pipeline (transcription-driven
cut lists, an AI Skill emitting scene plans) from ever working, since none of those
can shell out to ffmpeg to pre-cut files — they can only emit numbers into a spec.

## What Changes

- Add optional `sourceStartSeconds` and `sourceEndSeconds` fields to scene assets
  (both `a_roll` and `b_roll`) and to the `pip` overlay type, letting a spec point
  at an offset range within a source file instead of always starting at 0.
- When `sourceStartSeconds` is omitted, playback starts at 0 exactly as it does
  today — fully backward compatible, no existing spec's behavior changes.
- `duration` remains the sole driver of how long a scene/overlay plays; the new
  fields only shift _where in the source file_ playback begins (and optionally
  bound where it may end).
- New structural/semantic validation: `sourceEndSeconds` must exceed
  `sourceStartSeconds` when both are present; both must be non-negative.
- New render-time validation: the requested source range must fit within the
  asset's real (ffprobe-measured) duration, and must be long enough to cover
  `duration` — surfaced as a clear render failure instead of today's silent
  frozen-frame/dropped-audio behavior when a source is too short for what a spec
  asks of it.
- Rendering plumbs the resulting offset (in frames) through to Remotion's
  `trimBefore`/`trimAfter` on both the visual (`OffthreadVideo`) and every audio
  layer derived from a trimmed source — including the two independent
  audio-continuity systems (A-roll-chain audio and PIP own-audio).

## Capabilities

### New Capabilities

(none — this modifies existing capabilities only)

### Modified Capabilities

- `video-spec`: adds `sourceStartSeconds`/`sourceEndSeconds` to the scene base
  schema and to the `pip` overlay schema.
- `video-validation`: adds the `sourceEndSeconds > sourceStartSeconds` structural
  check, and a new render-time semantic check for the source range against the
  asset's real duration.
- `video-rendering`: scene visuals, PIP overlays, and both derived audio-span
  systems must honor a non-zero source offset via Remotion's trim props.

## Impact

- `packages/core/src/video-spec/schema.ts` — new optional fields on
  `sceneBaseSchema` and `pipOverlaySchema`.
- `packages/core/src/validation/validate.ts` / `errors.ts` — new structural check
  and a new `StructuredErrorCode`.
- `packages/core/src/rendering/Timeline.tsx`, `audioSpans.ts`,
  `probeAssetDimensions.ts` (or a render-time validation step alongside it) —
  trim plumbing through visual and audio rendering paths, plus the new
  asset-duration bounds check that can only run at render time.
- No changes to `packages/mcp` or `packages/cli` command surfaces — this is a
  Video Specification/rendering capability, not a new tool or command.
- Not a breaking change: every field is optional and the default (no offset)
  reproduces exactly today's behavior.

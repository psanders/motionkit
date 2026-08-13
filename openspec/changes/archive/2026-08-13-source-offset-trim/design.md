## Context

Every scene asset and PIP overlay asset currently plays from frame 0 of its source
file (`Timeline.tsx`'s `<OffthreadVideo src={...}>` / `<Audio src={...}>` mount with
no trim props), for exactly `duration * fps` frames. Reusing one long raw take
across multiple scenes, or as both a full-screen A-roll and a later PIP overlay,
currently has no in-spec way to say "start 12 seconds into this file" — the only
option is pre-cutting separate files by hand. `packages/core/src/video-spec/schema.ts`
(scene/overlay schemas), `packages/core/src/rendering/Timeline.tsx` (visual + audio
mounting), `packages/core/src/rendering/audioSpans.ts` (the two independent
audio-span derivations), and `packages/core/src/rendering/probeAssetDimensions.ts`
(the only place `render()` shells out to `ffprobe` today) are the touched surfaces.

Two facts already true about this codebase constrain the design:

- `validate()` is deliberately synchronous and never touches the filesystem beyond
  existence checks (`fs.existsSync`) — it never probes real asset duration. That
  split (structural/semantic checks in `validate()`, real-media checks only at
  render time via `ffprobe`) is an established pattern from `responsive-motion`,
  not something this change introduces.
- A `duration` exceeding an asset's real length already silently freezes the last
  frame / drops audio today, with no error at any stage. This change's render-time
  duration check closes that gap for the new fields, but does not retroactively
  add a check for `duration` alone exceeding an untrimmed asset's length — that's
  a real pre-existing gap, out of scope here, and worth its own follow-up.

## Goals / Non-Goals

**Goals:**

- Let a scene or PIP overlay declare `sourceStartSeconds` (and optionally
  `sourceEndSeconds`) to play a slice of a source file instead of always starting
  at 0.
- Keep every existing spec's behavior byte-identical when the new fields are
  absent.
- Fail renders clearly (not silently) when a requested source range doesn't fit
  the asset's real duration.
- Keep the audio-continuity model (`deriveAudioSpans` /
  `deriveOverlayAudioSpans`) correct under trimming — a trimmed A-roll's audio
  must start at the same source offset as its visual.

**Non-Goals:**

- No ffmpeg pre-cutting tooling, no automated sync/offset-detection, no filler-word
  removal — those stay a separate, unbuilt pipeline (see prior research).
- No fix for the pre-existing "untrimmed `duration` exceeds asset length" gap —
  real, but a separate concern from adding trim fields.
- No MCP tool surface changes.
- No changes to `cropTransform.ts`'s pan/zoom math — trimming affects _which_
  frames of the source are shown, not how they're cropped.

## Decisions

**1. Field placement and semantics: `sourceStartSeconds` / `sourceEndSeconds` on
`sceneBaseSchema` and `pipOverlaySchema`, both optional, `duration` stays the sole
playback-length driver.**

Considered making `sourceEndSeconds` (or an implied `sourceStartSeconds + duration`)
the _only_ way to express the range, dropping the separate `duration` field for
trimmed assets. Rejected: `duration` already means "how long this scene/overlay
occupies on the timeline" everywhere else in the schema (untrimmed scenes, PIP
overlays, transition math) — special-casing trimmed assets to derive timeline
duration from source range instead would make `duration` mean two different things
depending on whether trim fields are present. Keeping `duration` universal and
`sourceStartSeconds`/`sourceEndSeconds` purely about _where in the source file_
playback begins/may end is simpler for both humans and an AI agent authoring specs
to reason about, and matches how `motion`/`frame` are already independent,
orthogonal scene fields rather than mutually-exclusive modes.

`sourceEndSeconds` is optional and validated only for internal consistency
(`sourceEndSeconds > sourceStartSeconds`) plus, at render time, that the
`[sourceStartSeconds, sourceEndSeconds]` range is long enough to cover `duration`
and fits inside the real asset. It is not required to equal
`sourceStartSeconds + duration` exactly — an author may bound a range more loosely
than the exact playback length (e.g. as a guard rail) and that's fine.

**2. Structural/semantic split matches the existing `validate()`/render() boundary.**

`validate()` gets exactly one new synchronous check:
`sourceEndSeconds > sourceStartSeconds` when both are present (plus the existing
Zod-level non-negativity via `.nonnegative()` on both fields, which produces the
generic `MALFORMED_SPEC` mapping already established for structural numeric
violations — no new dedicated code needed for negativity, matching precedent from
`b_roll.audio`'s enum values). The asset-duration bounds check is new
render-time-only logic, colocated with `probeAssetDimensions.ts` rather than
inside `validate.ts`, because it requires the same `ffprobe` shell-out
`validate()` explicitly avoids. A new `StructuredErrorCode`,
`SOURCE_RANGE_EXCEEDS_ASSET_DURATION`, is added to `errors.ts` so this failure is
still a structured, machine-readable result — `render()` already refuses to run
against a `validate()` failure; this extends that same "fail clearly, never
silently" contract to a check that can only happen after `validate()` has passed.

**3. Rendering: add `probeAssetDurationSeconds()` alongside
`probeAssetDimensions()`, and thread `sourceStartFrame` through both `AudioSpan`
derivations.**

`probeAssetDimensions.ts` gets a sibling function, `probeAssetDurationSeconds()`,
following the exact same shape (its own `ffprobe -show_entries format=duration`
call, its own per-resolved-path cache, `clearAssetDurationCache()` for tests) —
not folded into the existing dimensions probe, since callers that only need
dimensions (the crop/pan/zoom path) shouldn't pay for or depend on a duration
probe, and vice versa. `render()` calls it once per scene/overlay asset that
declares `sourceStartSeconds` or `sourceEndSeconds`, before handing off to
Remotion, to run the new bounds check.

For the visual layer (`SceneVisual`, `PipOverlay` in `Timeline.tsx`), the fix is
local: compute `trimBefore = Math.round(sourceStartSeconds * fps)` and pass it to
`<OffthreadVideo>`; `trimAfter` similarly from `sourceEndSeconds` when present.

For audio, `AudioSpan` (`audioSpans.ts`) gains an optional `sourceStartFrame`
field. Both `deriveAudioSpans()` and `deriveOverlayAudioSpans()` already build one
`AudioSpan` per continuous asset-backed stretch of the timeline; each already
carries a single `asset`, so carrying that asset's own `sourceStartSeconds` (converted
to frames, same rounding as the visual layer) is a natural, non-breaking extension
of the existing shape. Critically: for a chained A-roll span (audio continuing
under one or more `"continue"` B-rolls), the trim offset applies once, at the
start of the whole span — it is a property of _where the audio track begins_, not
of each individual scene the chain passes through, so no change is needed to the
chaining logic itself, only to what gets carried alongside the `asset` field.
Wherever `Timeline.tsx` turns an `AudioSpan` into an `<Audio>` Sequence, it passes
`trimBefore={span.sourceStartFrame}` the same way the visual layer does.

**4. `sourceEndSeconds` does not need a `trimAfter` counterpart on the _audio_
layer for chained spans.**

`trimAfter` is derived independently for the visual mount (bounded by that one
scene's `sourceEndSeconds`) and is irrelevant to a chained audio span, whose
_audio_ end is governed by the span's total `durationInFrames` (already correct,
unchanged) — Remotion's `<Audio>` Sequence duration already stops playback at the
right point via its own `durationInFrames`/`Sequence` bounds regardless of
`trimAfter`. Only `trimBefore` needs plumbing into `AudioSpan`; `sourceEndSeconds`
stays purely a visual-layer + validation concern.

## Risks / Trade-offs

- **An extra `ffprobe` shell-out per trimmed asset, per render.** Mitigated by the
  same per-resolved-path caching pattern `probeAssetDimensions.ts` already uses;
  cost is bounded and only paid when trim fields are actually used.
- **`sourceEndSeconds` looseness (not required to equal
  `sourceStartSeconds + duration`) could confuse an author who expects it to be
  authoritative for length.** Mitigated by documenting `duration` as the sole
  playback-length driver in the delta spec's scenario language and in the README
  update already in flight; `sourceEndSeconds` is explicitly a bound, not a second
  source of truth for length.
- **The pre-existing "duration exceeds asset length" silent-failure gap remains
  for untrimmed assets.** Explicitly deferred (see Non-Goals); flagged here so
  it isn't mistaken for something this change already closes.

## Open Questions

- Should a future change extend the same render-time duration-bounds check to
  _untrimmed_ `duration` vs. asset length (the pre-existing gap), reusing
  `probeAssetDurationSeconds()`? Not blocking here, but the new probe makes that
  follow-up cheap once someone wants it.

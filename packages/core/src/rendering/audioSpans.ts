/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Derives the "audio spans" that drive A-roll audio continuity: which frame
 * range each A-roll's audio should cover, extended through any immediately
 * following B-roll scenes that continue it. Computed once, up front, as a
 * pure function of the spec — not decided per-frame during rendering. See
 * design.md decision #3 in the `foundation` OpenSpec change.
 */
import type { VideoSpec } from "../video-spec/types.js";

/** One continuous stretch of the timeline during which a single A-roll's audio should play. */
export interface AudioSpan {
  /** The A-roll asset (relative to the spec's directory) whose audio track plays for this span. */
  asset: string;
  /** The first frame, relative to the whole timeline, this audio starts on. */
  fromFrame: number;
  /** How many frames this audio keeps playing for. */
  durationInFrames: number;
  /**
   * The frame offset, within the source asset itself, this span's audio
   * should start reading from — derived from the originating scene's/
   * overlay's `sourceStartSeconds` (see design.md decision #3 in the
   * `source-offset-trim` OpenSpec change). Populated once per span, not per
   * scene the span's chain passes through: a chained A-roll's trim offset is
   * a property of where the audio track begins, not of each B-roll scene
   * that continues it. `undefined` when the originating asset declares no
   * `sourceStartSeconds` — today's default-from-0 behavior, unchanged.
   */
  sourceStartFrame?: number;
}

/**
 * Walks the scene list once, in order, chaining each A-roll's audio forward
 * through consecutive B-roll scenes that default to (or explicitly set)
 * `audio: "continue"`. The chain breaks — and the span closes — at the next
 * A-roll scene, or at a B-roll scene with `audio: "muted"`.
 */
export function deriveAudioSpans(spec: VideoSpec): AudioSpan[] {
  const spans: AudioSpan[] = [];
  let current: AudioSpan | null = null;
  let frame = 0;

  for (const scene of spec.scenes) {
    const durationInFrames = Math.round(scene.duration * spec.fps);

    if (scene.type === "a_roll") {
      if (current) spans.push(current);
      current = {
        asset: scene.asset,
        fromFrame: frame,
        durationInFrames,
        ...(scene.sourceStartSeconds !== undefined
          ? { sourceStartFrame: Math.round(scene.sourceStartSeconds * spec.fps) }
          : {})
      };
    } else if (scene.audio === "continue" && current) {
      current.durationInFrames += durationInFrames;
    } else {
      if (current) spans.push(current);
      current = null;
    }

    frame += durationInFrames;
  }

  if (current) spans.push(current);

  return spans;
}

/**
 * Derives one audio span per `overlays[]` entry with `audio: "own"`,
 * spanning its target scene's full frame range. Independent of
 * `deriveAudioSpans()` above — the two lists are rendered side by side, not
 * merged, which is what produces the deliberate "no automatic ducking"
 * behavior if a scene has both an inherited A-roll-continuity audio span and
 * an own-audio overlay (see design.md decision #5 in the `overlays-pip`
 * OpenSpec change).
 */
export function deriveOverlayAudioSpans(spec: VideoSpec): AudioSpan[] {
  const sceneOffsets: { fromFrame: number; durationInFrames: number }[] = [];
  let frame = 0;

  for (const scene of spec.scenes) {
    const durationInFrames = Math.round(scene.duration * spec.fps);
    sceneOffsets.push({ fromFrame: frame, durationInFrames });
    frame += durationInFrames;
  }

  const spans: AudioSpan[] = [];

  for (const overlay of spec.overlays ?? []) {
    if (overlay.audio !== "own") continue;
    const target = sceneOffsets[overlay.sceneIndex];
    // An out-of-range sceneIndex is a validation failure `render()` already
    // refuses to run against — `target` is always defined here in practice.
    if (!target) continue;
    spans.push({
      asset: overlay.asset,
      ...target,
      ...(overlay.sourceStartSeconds !== undefined
        ? { sourceStartFrame: Math.round(overlay.sourceStartSeconds * spec.fps) }
        : {})
    });
  }

  return spans;
}

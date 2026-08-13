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
      current = { asset: scene.asset, fromFrame: frame, durationInFrames };
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

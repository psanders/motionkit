/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * The "cover crop with a moving window" math: given a source asset's real
 * dimensions, the target composition's dimensions, and a scene's `motion`,
 * resolves the actual scale/translate to apply at a given frame. Pure
 * functions, no Remotion component context needed (aside from `interpolate`,
 * which — like the rest of this codebase's transition math — is a plain
 * function, not a hook) — see design.md decision #1 in the
 * `responsive-motion` OpenSpec change for the full derivation.
 */
import { interpolate } from "remotion";
import type { FocalPoint, Motion } from "../video-spec/types.js";

/** How much further than the cover-scale a `zoom` motion scales in by, by the end of its scene. Fixed for this phase — see design.md's stated trade-off. */
const ZOOM_END_SCALE_MULTIPLIER = 1.3;

const CENTER_FOCAL_POINT: FocalPoint = { x: 0.5, y: 0.5 };

const CLAMP_OPTS = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export interface ResolvedCrop {
  scale: number;
  translateX: number;
  translateY: number;
}

export interface CropTransformInput {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  /** Undefined = a fixed, centered cover-crop, exactly equivalent to `{ type: "static" }` with a centered focal point. */
  motion: Motion | undefined;
  /** The current frame, relative to the scene's own start (i.e. `useCurrentFrame()` from inside the scene's `<Sequence>`). */
  frame: number;
  /** The scene's total duration in frames. */
  durationInFrames: number;
}

/** The smallest scale where the scaled source fully covers the target frame — standard "object-fit: cover" math, computed explicitly. */
export function computeCoverScale(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): number {
  return Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** A scene's effective focal point: the declared one (clamped defensively — `validate()` is the source of truth for bounds), or a centered default. */
function resolveFocalPoint(motion: Motion | undefined): FocalPoint {
  const focalPoint = motion?.focalPoint;
  return focalPoint ? { x: clamp01(focalPoint.x), y: clamp01(focalPoint.y) } : CENTER_FOCAL_POINT;
}

/** The slack (in scaled-pixels) available to pan across on each axis, at a given scale — `0` on the axis the scale exactly covers. */
function computeSlack(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  scale: number
): { horizontal: number; vertical: number } {
  return {
    horizontal: Math.max(0, sourceWidth * scale - targetWidth),
    vertical: Math.max(0, sourceHeight * scale - targetHeight)
  };
}

/** The translate that positions a given scale's crop window at `focalPoint` — `0` shows the source's left/top edge, `-slack` shows its right/bottom edge. */
function translateForFocalPoint(
  slack: { horizontal: number; vertical: number },
  focalPoint: FocalPoint
): { translateX: number; translateY: number } {
  return {
    translateX: -slack.horizontal * focalPoint.x,
    translateY: -slack.vertical * focalPoint.y
  };
}

/**
 * Resolves the scale/translate a scene's visual should render at, at
 * `frame`. `motion` undefined, or `{ type: "static" }` with no focal point,
 * all resolve to the same fixed, centered cover-crop — the historical
 * (pre-`responsive-motion`) behavior.
 */
export function resolveCropTransform(input: CropTransformInput): ResolvedCrop {
  const { sourceWidth, sourceHeight, targetWidth, targetHeight, motion, frame, durationInFrames } =
    input;
  const coverScale = computeCoverScale(sourceWidth, sourceHeight, targetWidth, targetHeight);
  const focalPoint = resolveFocalPoint(motion);
  const type = motion?.type ?? "static";
  const canAnimate = durationInFrames > 0;

  if (type === "zoom") {
    const scale = canAnimate
      ? interpolate(
          frame,
          [0, durationInFrames],
          [coverScale, coverScale * ZOOM_END_SCALE_MULTIPLIER],
          CLAMP_OPTS
        )
      : coverScale;
    const slack = computeSlack(sourceWidth, sourceHeight, targetWidth, targetHeight, scale);
    return { scale, ...translateForFocalPoint(slack, focalPoint) };
  }

  const slack = computeSlack(sourceWidth, sourceHeight, targetWidth, targetHeight, coverScale);
  const { translateX: fixedX, translateY: fixedY } = translateForFocalPoint(slack, focalPoint);

  if (type === "horizontal_pan" && canAnimate) {
    const direction = motion?.type === "horizontal_pan" ? motion.direction : "left_to_right";
    const [startX, endX] =
      direction === "left_to_right" ? [0, -slack.horizontal] : [-slack.horizontal, 0];
    return {
      scale: coverScale,
      translateX: interpolate(frame, [0, durationInFrames], [startX, endX], CLAMP_OPTS),
      translateY: fixedY
    };
  }

  if (type === "vertical_pan" && canAnimate) {
    const direction = motion?.type === "vertical_pan" ? motion.direction : "top_to_bottom";
    const [startY, endY] =
      direction === "top_to_bottom" ? [0, -slack.vertical] : [-slack.vertical, 0];
    return {
      scale: coverScale,
      translateX: fixedX,
      translateY: interpolate(frame, [0, durationInFrames], [startY, endY], CLAMP_OPTS)
    };
  }

  // `static`, or a pan/zoom type with a zero-length window to animate across.
  return { scale: coverScale, translateX: fixedX, translateY: fixedY };
}

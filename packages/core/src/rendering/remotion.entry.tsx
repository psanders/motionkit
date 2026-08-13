/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Remotion bundle entry point. Registers the two format-aware compositions
 * — `MotionKit16x9` (1920x1080) and `MotionKit9x16` (1080x1920) — both
 * driven by the same `Timeline` root component, which reads `spec.format`
 * from its own props rather than one composition being CSS-scaled into the
 * other's aspect ratio. Duration and fps are computed per-spec via
 * `calculateMetadata`, since they depend on the actual Video Specification
 * passed as `inputProps` at render time, not a static default.
 */
import { Composition, registerRoot, type CalculateMetadataFunction } from "remotion";
import { Timeline, type TimelineProps } from "./Timeline.js";
import type { VideoSpec } from "../video-spec/types.js";

/** A structurally valid placeholder spec — overridden by real `inputProps` on every actual render. */
const DEFAULT_SPEC: VideoSpec = {
  version: "1",
  format: "16:9",
  fps: 30,
  scenes: [{ type: "a_roll", asset: "placeholder.mp4", duration: 1 }]
};

const calculateMetadata: CalculateMetadataFunction<TimelineProps> = ({ props }) => {
  const durationInFrames = props.spec.scenes.reduce(
    (total, scene) => total + Math.round(scene.duration * props.spec.fps),
    0
  );

  return { durationInFrames, fps: props.spec.fps, props };
};

function Root() {
  return (
    <>
      <Composition
        id="MotionKit16x9"
        component={Timeline}
        width={1920}
        height={1080}
        defaultProps={{ spec: DEFAULT_SPEC }}
        calculateMetadata={calculateMetadata}
      />
      <Composition
        id="MotionKit9x16"
        component={Timeline}
        width={1080}
        height={1920}
        defaultProps={{ spec: { ...DEFAULT_SPEC, format: "9:16" } }}
        calculateMetadata={calculateMetadata}
      />
    </>
  );
}

registerRoot(Root);

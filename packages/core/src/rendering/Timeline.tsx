/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * The shared root component both format compositions render. Maps a Video
 * Specification's scenes onto Remotion `<Sequence>`s (visuals), plus a
 * separately-derived set of `<Sequence>`s for A-roll audio continuity, so
 * audio can outlive the visual scene that introduced it.
 */
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame
} from "remotion";
import type { Scene, VideoSpec } from "../video-spec/types.js";
import { deriveAudioSpans } from "./audioSpans.js";

/** How long a `fade` transition's opacity ramp lasts, in frames. Fixed and short, per design.md decision #3. */
export const FADE_DURATION_IN_FRAMES = 15;

export interface TimelineProps {
  spec: VideoSpec;
  // Remotion's `<Composition>` constrains its props generic to
  // `Record<string, unknown>` — this index signature satisfies that without
  // widening how the rest of the module uses `TimelineProps`.
  [key: string]: unknown;
}

interface SceneWithOffset {
  scene: Scene;
  from: number;
  durationInFrames: number;
}

/** Assigns each scene a start frame equal to the cumulative duration (in frames) of every scene before it. */
function withOffsets(spec: VideoSpec): SceneWithOffset[] {
  let frame = 0;

  return spec.scenes.map((scene) => {
    const durationInFrames = Math.round(scene.duration * spec.fps);
    const from = frame;
    frame += durationInFrames;
    return { scene, from, durationInFrames };
  });
}

export function Timeline({ spec }: TimelineProps) {
  const scenesWithOffsets = withOffsets(spec);
  const audioSpans = deriveAudioSpans(spec);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {scenesWithOffsets.map(({ scene, from, durationInFrames }, index) => (
        <Sequence key={`scene-${index}`} from={from} durationInFrames={durationInFrames}>
          <SceneVisual scene={scene} />
        </Sequence>
      ))}
      {audioSpans.map((span, index) => (
        <Sequence
          key={`audio-${index}`}
          from={span.fromFrame}
          durationInFrames={span.durationInFrames}
        >
          <Audio src={staticFile(span.asset)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

/** Renders one scene's visuals, applying the fixed opacity fade-in when the scene declares a `fade` transition. */
function SceneVisual({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame();
  const isFade = scene.transition?.type === "fade";
  const opacity = isFade
    ? interpolate(frame, [0, FADE_DURATION_IN_FRAMES], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp"
      })
    : 1;

  return (
    <AbsoluteFill style={{ opacity }}>
      <OffthreadVideo
        src={staticFile(scene.asset)}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AbsoluteFill>
  );
}

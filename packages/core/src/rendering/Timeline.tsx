/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * The shared root component both format compositions render. Maps a Video
 * Specification's scenes onto Remotion `<Sequence>`s (visuals), plus a
 * separately-derived set of `<Sequence>`s for A-roll audio continuity, so
 * audio can outlive the visual scene that introduced it. Captions, the
 * browser-chrome frame, and the logo are additive layers within a scene's
 * own `<Sequence>` (see design.md decision #4) — not new scene types.
 */
import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame
} from "remotion";
import type { Brand, Placement } from "../brand/types.js";
import type { Scene, Transition, VideoSpec } from "../video-spec/types.js";
import { deriveAudioSpans } from "./audioSpans.js";

/** How far zoomed out a `zoom` transition starts before settling to its natural scale. */
const ZOOM_START_SCALE = 0.4;

export interface TimelineProps {
  spec: VideoSpec;
  brand: Brand;
  // Remotion's `<Composition>` constrains its props generic to
  // `Record<string, unknown>` — this index signature satisfies that without
  // widening how the rest of the module uses `TimelineProps`.
  [key: string]: unknown;
}

interface SceneWithOffset {
  scene: Scene;
  from: number;
  durationInFrames: number;
  /** This scene's resolved transition window, in frames — 0 when the scene declares no transition. */
  transitionDurationInFrames: number;
}

/**
 * Resolves a transition's actual duration in frames: the scene's own
 * explicit duration when given, otherwise the active brand's default (see
 * design.md decision #5). Exported so tests can compute the same window
 * the renderer uses instead of duplicating the resolution rule.
 */
export function resolveTransitionDurationInFrames(
  transition: Transition | undefined,
  brand: Brand,
  fps: number
): number {
  if (!transition) return 0;
  const seconds = transition.duration ?? brand.defaultTransitionDurationSeconds;
  return Math.round(seconds * fps);
}

/** Assigns each scene a start frame equal to the cumulative duration (in frames) of every scene before it, and resolves its transition window once, up front (mirrors `audioSpans.ts`'s pattern — not decided per-frame). */
function withOffsets(spec: VideoSpec, brand: Brand): SceneWithOffset[] {
  let frame = 0;

  return spec.scenes.map((scene) => {
    const durationInFrames = Math.round(scene.duration * spec.fps);
    const from = frame;
    frame += durationInFrames;
    return {
      scene,
      from,
      durationInFrames,
      transitionDurationInFrames: resolveTransitionDurationInFrames(
        scene.transition,
        brand,
        spec.fps
      )
    };
  });
}

export function Timeline({ spec, brand }: TimelineProps) {
  const scenesWithOffsets = withOffsets(spec, brand);
  const audioSpans = deriveAudioSpans(spec);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {scenesWithOffsets.map(
        ({ scene, from, durationInFrames, transitionDurationInFrames }, index) => (
          <Sequence key={`scene-${index}`} from={from} durationInFrames={durationInFrames}>
            <SceneLayers
              scene={scene}
              brand={brand}
              transitionDurationInFrames={transitionDurationInFrames}
            />
          </Sequence>
        )
      )}
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

/** Composes one scene's visual, plus its optional browser-frame wrapper, caption overlay, and logo overlay. */
function SceneLayers({
  scene,
  brand,
  transitionDurationInFrames
}: {
  scene: Scene;
  brand: Brand;
  transitionDurationInFrames: number;
}) {
  const visual = (
    <SceneVisual scene={scene} transitionDurationInFrames={transitionDurationInFrames} />
  );

  return (
    <AbsoluteFill>
      {scene.frame === "browser" ? <BrowserFrame brand={brand}>{visual}</BrowserFrame> : visual}
      {scene.caption ? <CaptionOverlay text={scene.caption} brand={brand} /> : null}
      {scene.logo ? (
        <LogoOverlay
          brand={brand}
          position={scene.logo === true ? brand.logo.defaultPosition : scene.logo.position}
        />
      ) : null}
    </AbsoluteFill>
  );
}

/** Renders one scene's visuals, applying the resolved transition's transform/opacity ramp when the scene declares one. */
function SceneVisual({
  scene,
  transitionDurationInFrames
}: {
  scene: Scene;
  transitionDurationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const style = transitionStyle(scene.transition?.type, frame, transitionDurationInFrames);

  return (
    <AbsoluteFill style={style}>
      <OffthreadVideo
        src={staticFile(scene.asset)}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AbsoluteFill>
  );
}

/** Computes the CSS driving a transition's entrance effect — same plain `interpolate()` technique for every type, per design.md decision #5. */
function transitionStyle(
  type: Transition["type"] | undefined,
  frame: number,
  durationInFrames: number
): CSSProperties {
  if (!type || durationInFrames <= 0) return {};

  const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

  switch (type) {
    case "fade":
      return { opacity: interpolate(frame, [0, durationInFrames], [0, 1], clampOpts) };
    case "slide-left":
      return {
        transform: `translateX(${interpolate(frame, [0, durationInFrames], [100, 0], clampOpts)}%)`
      };
    case "slide-right":
      return {
        transform: `translateX(${interpolate(frame, [0, durationInFrames], [-100, 0], clampOpts)}%)`
      };
    case "zoom":
      return {
        transform: `scale(${interpolate(frame, [0, durationInFrames], [ZOOM_START_SCALE, 1], clampOpts)})`
      };
    default:
      return {};
  }
}

/** Wraps a scene's visual content in a static browser-chrome frame, styled per the active brand's `browserFrameStyle` — pure CSS, no motion. */
function BrowserFrame({ brand, children }: { brand: Brand; children: ReactNode }) {
  const { chromeColor, chromeHeightPx, borderRadius, shadow } = brand.browserFrameStyle;

  return (
    <AbsoluteFill style={{ padding: brand.spacing.lg }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius,
          overflow: "hidden",
          boxShadow: shadow,
          display: "flex",
          flexDirection: "column"
        }}
      >
        <div style={{ height: chromeHeightPx, flexShrink: 0, backgroundColor: chromeColor }} />
        <div style={{ position: "relative", flex: 1 }}>{children}</div>
      </div>
    </AbsoluteFill>
  );
}

/** Renders a scene's caption as a bottom-center text overlay, styled per the active brand's `captionStyle` (no per-scene position override this phase — see design.md Non-Goals). */
function CaptionOverlay({ text, brand }: { text: string; brand: Brand }) {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        padding: brand.spacing.lg
      }}
    >
      <div
        style={{
          fontFamily: brand.typography.fontFamily,
          fontSize: brand.captionStyle.fontSize,
          color: brand.captionStyle.color,
          backgroundColor: brand.captionStyle.backgroundColor,
          padding: `${brand.spacing.sm}px ${brand.spacing.md}px`,
          borderRadius: brand.borderRadius.sm,
          textAlign: "center"
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

const LOGO_SIZE_PX = 120;

const POSITION_STYLES: Record<Placement, CSSProperties> = {
  top_left: { top: 0, left: 0 },
  top_right: { top: 0, right: 0 },
  bottom_left: { bottom: 0, left: 0 },
  bottom_right: { bottom: 0, right: 0 },
  center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
};

/** Renders the active brand's logo over a scene, at `scene.logo.position` or the brand's default placement. */
function LogoOverlay({ brand, position }: { brand: Brand; position: Placement }) {
  return (
    <AbsoluteFill style={{ padding: brand.spacing.md }}>
      <Img
        src={brand.logo.asset}
        style={{
          position: "absolute",
          width: LOGO_SIZE_PX,
          height: LOGO_SIZE_PX,
          objectFit: "contain",
          ...POSITION_STYLES[position]
        }}
      />
    </AbsoluteFill>
  );
}

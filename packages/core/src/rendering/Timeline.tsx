/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * The shared root component all three format compositions render. Maps a
 * Video Specification's scenes onto Remotion `<Sequence>`s (visuals), plus a
 * separately-derived set of `<Sequence>`s for A-roll audio continuity, so
 * audio can outlive the visual scene that introduced it. Captions, the
 * chrome frame decoration, and the logo are additive layers within a scene's
 * own `<Sequence>` (see `brand-system`'s design.md decision #4) — not new
 * scene types; neither is a scene's `motion` (a crop/pan/zoom applied to the
 * source itself — see `cropTransform.ts` and `responsive-motion`'s design.md
 * decision #1).
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
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import type { Brand, Placement } from "../brand/types.js";
import type { PipOverlay, Scene, SceneFrame, Transition, VideoSpec } from "../video-spec/types.js";
import { deriveAudioSpans, deriveOverlayAudioSpans } from "./audioSpans.js";
import { resolveCropTransform } from "./cropTransform.js";
import type { AssetDimensions } from "./probeAssetDimensions.js";

/** How far zoomed out a `zoom` transition starts before settling to its natural scale. */
const ZOOM_START_SCALE = 0.4;

export interface TimelineProps {
  spec: VideoSpec;
  brand: Brand;
  /** Every scene asset's real dimensions, keyed by the scene's own `asset` string (see `render.ts`'s `probeSceneAssetDimensions`) — the crop/pan/zoom math needs the source's actual size, not just the target composition's. */
  assetDimensions: Record<string, AssetDimensions>;
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

/** Groups `overlays[]` by the scene index each one targets, so `SceneLayers` only needs the handful relevant to its own scene. */
function groupOverlaysByScene(spec: VideoSpec): Map<number, PipOverlay[]> {
  const bySceneIndex = new Map<number, PipOverlay[]>();

  for (const overlay of spec.overlays ?? []) {
    const existing = bySceneIndex.get(overlay.sceneIndex);
    if (existing) {
      existing.push(overlay);
    } else {
      bySceneIndex.set(overlay.sceneIndex, [overlay]);
    }
  }

  return bySceneIndex;
}

export function Timeline({ spec, brand, assetDimensions }: TimelineProps) {
  const { width: targetWidth, height: targetHeight } = useVideoConfig();
  const scenesWithOffsets = withOffsets(spec, brand);
  const audioSpans = deriveAudioSpans(spec);
  const overlayAudioSpans = deriveOverlayAudioSpans(spec);
  const overlaysByScene = groupOverlaysByScene(spec);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {scenesWithOffsets.map(
        ({ scene, from, durationInFrames, transitionDurationInFrames }, index) => (
          <Sequence key={`scene-${index}`} from={from} durationInFrames={durationInFrames}>
            <SceneLayers
              scene={scene}
              brand={brand}
              durationInFrames={durationInFrames}
              transitionDurationInFrames={transitionDurationInFrames}
              sourceDimensions={
                assetDimensions[scene.asset] ?? { width: targetWidth, height: targetHeight }
              }
              targetWidth={targetWidth}
              targetHeight={targetHeight}
              overlays={overlaysByScene.get(index) ?? []}
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
      {overlayAudioSpans.map((span, index) => (
        <Sequence
          key={`overlay-audio-${index}`}
          from={span.fromFrame}
          durationInFrames={span.durationInFrames}
        >
          <Audio src={staticFile(span.asset)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

/** Composes one scene's visual, plus its optional frame wrapper, caption overlay, logo overlay, and any PIP overlays anchored to it. */
function SceneLayers({
  scene,
  brand,
  durationInFrames,
  transitionDurationInFrames,
  sourceDimensions,
  targetWidth,
  targetHeight,
  overlays
}: {
  scene: Scene;
  brand: Brand;
  durationInFrames: number;
  transitionDurationInFrames: number;
  sourceDimensions: AssetDimensions;
  targetWidth: number;
  targetHeight: number;
  overlays: PipOverlay[];
}) {
  const visual = (
    <SceneVisual
      scene={scene}
      durationInFrames={durationInFrames}
      transitionDurationInFrames={transitionDurationInFrames}
      sourceDimensions={sourceDimensions}
      targetWidth={targetWidth}
      targetHeight={targetHeight}
    />
  );

  return (
    <AbsoluteFill>
      {scene.frame ? (
        <FrameDecoration brand={brand} frame={scene.frame}>
          {visual}
        </FrameDecoration>
      ) : (
        visual
      )}
      {scene.caption ? <CaptionOverlay text={scene.caption} brand={brand} /> : null}
      {scene.logo ? (
        <LogoOverlay
          brand={brand}
          position={scene.logo === true ? brand.logo.defaultPosition : scene.logo.position}
        />
      ) : null}
      {overlays.map((overlay, index) => (
        <PipOverlay key={`pip-${index}`} overlay={overlay} brand={brand} />
      ))}
    </AbsoluteFill>
  );
}

/**
 * Renders one scene's visuals: the source, cropped/panned/zoomed per its
 * `motion` (see `cropTransform.ts` — undefined `motion` resolves to the same
 * fixed, centered cover-crop as before this change), wrapped in an
 * `overflow: hidden` viewport so an oversized, translated source clips
 * correctly. The scene-level transition's transform/opacity ramp applies to
 * that viewport, not the source itself, so the two compose independently
 * rather than fighting over one `transform`.
 */
function SceneVisual({
  scene,
  durationInFrames,
  transitionDurationInFrames,
  sourceDimensions,
  targetWidth,
  targetHeight
}: {
  scene: Scene;
  durationInFrames: number;
  transitionDurationInFrames: number;
  sourceDimensions: AssetDimensions;
  targetWidth: number;
  targetHeight: number;
}) {
  const frame = useCurrentFrame();
  const transitionCss = transitionStyle(scene.transition?.type, frame, transitionDurationInFrames);
  const crop = resolveCropTransform({
    sourceWidth: sourceDimensions.width,
    sourceHeight: sourceDimensions.height,
    targetWidth,
    targetHeight,
    motion: scene.motion,
    frame,
    durationInFrames
  });

  return (
    <AbsoluteFill style={{ ...transitionCss, overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(scene.asset)}
        muted
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: sourceDimensions.width * crop.scale,
          height: sourceDimensions.height * crop.scale,
          transform: `translate(${crop.translateX}px, ${crop.translateY}px)`
        }}
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

/** The classic macOS traffic-light window controls, only shown on `frame: "browser"` — a `"phone"` frame has no window chrome to speak of. Fixed OS-chrome colors, not a brand token (these read as "this is a browser window," not as brand identity). */
const MACOS_TRAFFIC_LIGHT_COLORS = ["#FF5F57", "#FEBC2E", "#28C840"];
const TRAFFIC_LIGHT_DOT_SIZE_PX = 22;
const TRAFFIC_LIGHT_GAP_PX = 8;
const TRAFFIC_LIGHT_INSET_PX = 14;

/** Wraps a scene's visual content in a static chrome frame — `"browser"` or `"phone"` — styled per the matching brand token (`browserFrameStyle`/`phoneFrameStyle`). Same outer structure for both; only the token source (and the browser-only traffic lights) differ, per design.md's "simplified chrome, not a detailed bezel" decision. Pure CSS, no motion. */
function FrameDecoration({
  brand,
  frame,
  children
}: {
  brand: Brand;
  frame: SceneFrame;
  children: ReactNode;
}) {
  const { chromeColor, chromeHeightPx, borderRadius, shadow } =
    frame === "browser" ? brand.browserFrameStyle : brand.phoneFrameStyle;

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
        <div
          style={{
            height: chromeHeightPx,
            flexShrink: 0,
            backgroundColor: chromeColor,
            display: "flex",
            alignItems: "center",
            gap: TRAFFIC_LIGHT_GAP_PX,
            paddingLeft: frame === "browser" ? TRAFFIC_LIGHT_INSET_PX : 0
          }}
        >
          {frame === "browser"
            ? MACOS_TRAFFIC_LIGHT_COLORS.map((color) => (
                <div
                  key={color}
                  style={{
                    width: TRAFFIC_LIGHT_DOT_SIZE_PX,
                    height: TRAFFIC_LIGHT_DOT_SIZE_PX,
                    borderRadius: "50%",
                    backgroundColor: color
                  }}
                />
              ))
            : null}
        </div>
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

/**
 * Edge-anchored placement styles, inset by `insetPx` from the frame's edge.
 * Deliberately NOT implemented as padding on the wrapping `AbsoluteFill` —
 * an absolutely-positioned child's `top`/`left`/`right`/`bottom: 0` is
 * measured from its containing block's padding edge, which coincides with
 * the frame's true outer edge regardless of the wrapper's own padding, so a
 * padding-based inset silently does nothing. Baking the inset directly into
 * the offset values is what actually moves the element in from the edge.
 */
function positionStyles(insetPx: number): Record<Placement, CSSProperties> {
  return {
    top_left: { top: insetPx, left: insetPx },
    top_right: { top: insetPx, right: insetPx },
    bottom_left: { bottom: insetPx, left: insetPx },
    bottom_right: { bottom: insetPx, right: insetPx },
    center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
  };
}

const LOGO_POSITION_STYLES = positionStyles(0);

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
          ...LOGO_POSITION_STYLES[position]
        }}
      />
    </AbsoluteFill>
  );
}

/** A `rounded_square` PIP's corner radius, as a fraction of its size — a fixed proportion rather than a brand token, keeping `pipStyle`'s surface small (border/shadow/color are brand identity; "how rounded" is closer to `shape` itself). */
const PIP_ROUNDED_SQUARE_RADIUS_RATIO = 0.2;

/** How far a PIP bubble sits in from the frame's edge. Fixed rather than a brand token for now — revisit if a brand wants a different inset. */
const PIP_EDGE_INSET_PX = 100;

const PIP_POSITION_STYLES = positionStyles(PIP_EDGE_INSET_PX);

/** Renders a PIP overlay: a shape-clipped, cover-scaled video bubble on top of a scene's other layers, sized/positioned/styled per the active brand's `pipStyle` and the overlay's own `position`/`shape`/`size` overrides. No pan/zoom applied to the bubble's own content this phase — see design.md Non-Goals. */
function PipOverlay({ overlay, brand }: { overlay: PipOverlay; brand: Brand }) {
  const { pipStyle } = brand;
  const position = overlay.position ?? pipStyle.defaultPosition;
  const sizePx = pipStyle.size[overlay.size];
  const borderRadius =
    overlay.shape === "circle" ? sizePx / 2 : sizePx * PIP_ROUNDED_SQUARE_RADIUS_RATIO;
  const border =
    pipStyle.borderWidth > 0 ? `${pipStyle.borderWidth}px solid ${pipStyle.borderColor}` : "none";

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          width: sizePx,
          height: sizePx,
          borderRadius,
          overflow: "hidden",
          border,
          boxShadow: pipStyle.shadow,
          ...PIP_POSITION_STYLES[position]
        }}
      >
        <OffthreadVideo
          src={staticFile(overlay.asset)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    </AbsoluteFill>
  );
}

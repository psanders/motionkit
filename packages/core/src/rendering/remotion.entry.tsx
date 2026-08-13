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
import type { Brand } from "../brand/types.js";
import type { VideoSpec } from "../video-spec/types.js";

/** A structurally valid placeholder spec — overridden by real `inputProps` on every actual render. */
const DEFAULT_SPEC: VideoSpec = {
  version: "1",
  format: "16:9",
  fps: 30,
  brand: "default",
  scenes: [{ type: "a_roll", asset: "placeholder.mp4", duration: 1 }]
};

/**
 * A structurally valid placeholder brand — like `DEFAULT_SPEC`, overridden
 * by the real resolved `Brand` `render.ts` passes as `inputProps` on every
 * actual render. Kept as an inline literal (not loaded via `loadBrand()`)
 * since this entry point is bundled into a browser context, not run under
 * Node.
 */
const DEFAULT_BRAND: Brand = {
  colors: {
    primary: "#4F46E5",
    secondary: "#1E293B",
    background: "#0F172A",
    text: "#F8FAFC",
    accent: "#22D3EE"
  },
  typography: {
    fontFamily: "system-ui, sans-serif",
    sizes: { title: 72, subtitle: 40, caption: 32, cta: 36 }
  },
  logo: { asset: "", defaultPosition: "bottom_right" },
  spacing: { sm: 8, md: 16, lg: 32 },
  borderRadius: { sm: 4, md: 8, lg: 16 },
  shadows: { sm: "none", md: "none", lg: "none" },
  captionStyle: { fontSize: 32, color: "#F8FAFC", backgroundColor: "rgba(15,23,42,0.75)" },
  titleStyle: { fontSize: 72, color: "#F8FAFC", fontWeight: "700" },
  lowerThirdStyle: { backgroundColor: "#1E293B", textColor: "#F8FAFC", fontSize: 36 },
  browserFrameStyle: {
    chromeColor: "#1E293B",
    chromeHeightPx: 40,
    borderRadius: 12,
    shadow: "none"
  },
  phoneFrameStyle: {
    chromeColor: "#1E293B",
    chromeHeightPx: 28,
    borderRadius: 32,
    shadow: "none"
  },
  pipStyle: {
    size: { sm: 140, md: 220, lg: 320 },
    borderWidth: 4,
    borderColor: "#F8FAFC",
    shadow: "none",
    defaultPosition: "bottom_left"
  },
  ctaStyle: { backgroundColor: "#4F46E5", textColor: "#F8FAFC", fontSize: 36, borderRadius: 8 },
  defaultTransitionDurationSeconds: 0.5
};

/**
 * No probed dimensions in the placeholder default props (nothing to probe —
 * see `DEFAULT_SPEC`'s comment). `Timeline.tsx` falls back to treating a
 * missing entry as already matching the target composition (cover scale 1,
 * no pan/zoom slack) rather than requiring one.
 */
const DEFAULT_ASSET_DIMENSIONS = {};

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
        defaultProps={{
          spec: DEFAULT_SPEC,
          brand: DEFAULT_BRAND,
          assetDimensions: DEFAULT_ASSET_DIMENSIONS
        }}
        calculateMetadata={calculateMetadata}
      />
      <Composition
        id="MotionKit9x16"
        component={Timeline}
        width={1080}
        height={1920}
        defaultProps={{
          spec: { ...DEFAULT_SPEC, format: "9:16" },
          brand: DEFAULT_BRAND,
          assetDimensions: DEFAULT_ASSET_DIMENSIONS
        }}
        calculateMetadata={calculateMetadata}
      />
      <Composition
        id="MotionKit1x1"
        component={Timeline}
        width={1080}
        height={1080}
        defaultProps={{
          spec: { ...DEFAULT_SPEC, format: "1:1" },
          brand: DEFAULT_BRAND,
          assetDimensions: DEFAULT_ASSET_DIMENSIONS
        }}
        calculateMetadata={calculateMetadata}
      />
    </>
  );
}

registerRoot(Root);

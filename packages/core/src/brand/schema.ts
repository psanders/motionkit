/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * The Brand schema — a design-token document (colors, typography, logo,
 * spacing, border-radius, shadows, and per-primitive style presets) that
 * gives a Video Specification its visual identity without inlining any of
 * that into the spec itself. See `../brand/registry.ts` for how a brand id
 * resolves to a parsed, validated document of this shape.
 */
import { z } from "zod/v4";

/** Where a positioned element (a logo, in this phase) anchors within the frame. */
export const placementSchema = z.enum(
  ["top_left", "top_right", "bottom_left", "bottom_right", "center"],
  { error: "Position must be one of: top_left, top_right, bottom_left, bottom_right, center" }
);

/** The brand's core color palette. */
const colorsSchema = z.object({
  primary: z.string().min(1, "primary color is required"),
  secondary: z.string().min(1, "secondary color is required"),
  background: z.string().min(1, "background color is required"),
  text: z.string().min(1, "text color is required"),
  accent: z.string().min(1, "accent color is required")
});

/** The brand's type scale, one size per primitive that renders text. */
const typographySchema = z.object({
  fontFamily: z.string().min(1, "fontFamily is required"),
  sizes: z.object({
    title: z.number().positive(),
    subtitle: z.number().positive(),
    caption: z.number().positive(),
    cta: z.number().positive()
  })
});

/** The brand's logo: an asset path (resolved relative to the brand file's own directory, not the spec's) and its default on-screen placement. */
const logoSchema = z.object({
  asset: z.string().min(1, "logo asset path is required"),
  defaultPosition: placementSchema
});

/** A 3-step scale (small/medium/large), reused for spacing and border-radius, both in pixels. */
const scaleSchema = z.object({
  sm: z.number().nonnegative(),
  md: z.number().nonnegative(),
  lg: z.number().nonnegative()
});

/** A 3-step scale of CSS `box-shadow` values — Remotion renders through React/CSS, so this is the natural representation. */
const shadowsSchema = z.object({
  sm: z.string(),
  md: z.string(),
  lg: z.string()
});

/** How a scene's caption overlay is styled. Rendered at a fixed bottom-center position in this phase — see design.md's caption non-goal. */
const captionStyleSchema = z.object({
  fontSize: z.number().positive(),
  color: z.string().min(1),
  backgroundColor: z.string().min(1)
});

/** How on-screen titles are styled. Not consumed by rendering yet — no title scene field exists this phase. */
const titleStyleSchema = z.object({
  fontSize: z.number().positive(),
  color: z.string().min(1),
  fontWeight: z.string().min(1)
});

/** How a lower-third would be styled. Validated/loaded only — no lower-third scene type exists yet (see design.md Non-Goals). */
const lowerThirdStyleSchema = z.object({
  backgroundColor: z.string().min(1),
  textColor: z.string().min(1),
  fontSize: z.number().positive()
});

/** How `scene.frame === "browser"`'s chrome is styled. */
const browserFrameStyleSchema = z.object({
  chromeColor: z.string().min(1),
  chromeHeightPx: z.number().positive(),
  borderRadius: z.number().nonnegative(),
  shadow: z.string()
});

/** How `scene.frame === "phone"`'s chrome is styled. Same shape as `browserFrameStyleSchema` — a simplified phone chrome (a colored top strip, border-radius, shadow), not a detailed device bezel. */
const phoneFrameStyleSchema = z.object({
  chromeColor: z.string().min(1),
  chromeHeightPx: z.number().positive(),
  borderRadius: z.number().nonnegative(),
  shadow: z.string()
});

/** How a PIP overlay bubble is styled — a size scale (px, per `pipSizeSchema`'s `sm`/`md`/`lg`), a border, a shadow, and a default placement (overridable per overlay, same "brand supplies the default" pattern as `logo.defaultPosition`). */
const pipStyleSchema = z.object({
  size: scaleSchema,
  borderWidth: z.number().nonnegative(),
  borderColor: z.string().min(1),
  shadow: z.string(),
  defaultPosition: placementSchema
});

/** How a call-to-action would be styled. Validated/loaded only — no CTA scene type exists yet (see design.md Non-Goals). */
const ctaStyleSchema = z.object({
  backgroundColor: z.string().min(1),
  textColor: z.string().min(1),
  fontSize: z.number().positive(),
  borderRadius: z.number().nonnegative()
});

/** A Brand: the full set of design tokens a Video Specification can reference by id instead of inlining. */
export const brandSchema = z.object({
  colors: colorsSchema,
  typography: typographySchema,
  logo: logoSchema,
  spacing: scaleSchema,
  borderRadius: scaleSchema,
  shadows: shadowsSchema,
  captionStyle: captionStyleSchema,
  titleStyle: titleStyleSchema,
  lowerThirdStyle: lowerThirdStyleSchema,
  browserFrameStyle: browserFrameStyleSchema,
  phoneFrameStyle: phoneFrameStyleSchema,
  pipStyle: pipStyleSchema,
  ctaStyle: ctaStyleSchema,
  defaultTransitionDurationSeconds: z.number().positive()
});

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * The Video Specification schema — a structured, versioned document
 * describing a video as data: an output format, a frame rate, and an
 * ordered timeline of scenes. This is the contract between the
 * creative/AI layer and the MotionKit rendering engine.
 */
import { z } from "zod/v4";
import { placementSchema } from "../brand/schema.js";

/** The output formats supported by MotionKit in this phase. */
export const videoFormatSchema = z.enum(["16:9", "9:16", "1:1"], {
  error: "Format must be one of: 16:9, 9:16, 1:1"
});

/** The transition types supported by MotionKit in this phase. */
export const transitionSchema = z.object({
  type: z.enum(["fade", "slide-left", "slide-right", "zoom"], {
    error: "Transition type must be one of: fade, slide-left, slide-right, zoom"
  }),
  /**
   * Duration in seconds. Optional — when omitted, the active brand's
   * `defaultTransitionDurationSeconds` applies instead (see design.md
   * decision #5). Not constrained to positive here for the same reason
   * `duration` below isn't: that's a semantic rule for `validate()`, not a
   * structural one.
   */
  duration: z.number().optional()
});

/** The static, decorative frame a scene can be wrapped in. */
export const sceneFrameSchema = z.enum(["browser", "phone"], {
  error: 'Frame must be one of: "browser", "phone"'
});

/** Where a pan/zoom biases its crop, or centers on when `static`. Normalized 0-1 within the source asset; bounds are checked semantically by `validate()`, not structurally, so an out-of-range value is reported alongside other semantic violations. */
export const focalPointSchema = z.object({
  x: z.number(),
  y: z.number()
});

const motionBaseSchema = {
  focalPoint: focalPointSchema.optional()
};

/**
 * `motion` is a discriminated union on `type`, exactly like `sceneSchema`
 * above — each variant declares only the `direction` values (if any) valid
 * for its own type. Every variant is `.strict()` (unlike the looser scene
 * schemas) specifically so a `direction` field on `zoom`/`static` — which
 * have no `direction` — is a structural validation failure rather than
 * silently stripped, per design.md decision #5.
 */
export const horizontalPanMotionSchema = z
  .object({
    type: z.literal("horizontal_pan"),
    direction: z
      .enum(["left_to_right", "right_to_left"], {
        error: "direction must be one of: left_to_right, right_to_left"
      })
      .default("left_to_right"),
    ...motionBaseSchema
  })
  .strict();

export const verticalPanMotionSchema = z
  .object({
    type: z.literal("vertical_pan"),
    direction: z
      .enum(["top_to_bottom", "bottom_to_top"], {
        error: "direction must be one of: top_to_bottom, bottom_to_top"
      })
      .default("top_to_bottom"),
    ...motionBaseSchema
  })
  .strict();

export const zoomMotionSchema = z
  .object({
    type: z.literal("zoom"),
    ...motionBaseSchema
  })
  .strict();

export const staticMotionSchema = z
  .object({
    type: z.literal("static"),
    ...motionBaseSchema
  })
  .strict();

/** Semantic pan/zoom/crop intent for a scene — not pixel-level transforms. See `../rendering/cropTransform.ts` for how this becomes an actual crop. */
export const motionSchema = z.discriminatedUnion("type", [
  horizontalPanMotionSchema,
  verticalPanMotionSchema,
  zoomMotionSchema,
  staticMotionSchema
]);

/** A scene's optional logo overlay: either `true` (use the active brand's default placement) or an explicit position override. */
export const sceneLogoSchema = z.union([z.literal(true), z.object({ position: placementSchema })]);

/** Fields shared by every scene type. */
const sceneBaseSchema = {
  asset: z.string().min(1, "Asset path is required"),
  /**
   * Duration in seconds. Deliberately not constrained to positive numbers
   * here — a non-positive duration is a semantic rule enforced by
   * `validate()` (see `../validation/validate.ts`), not a structural one,
   * so that it can be reported alongside other semantic violations (e.g. a
   * missing asset) in a single validation pass instead of short-circuiting
   * at the structural stage.
   */
  duration: z.number(),
  transition: transitionSchema.optional(),
  /**
   * Text overlaid for this scene's duration, styled per the active brand's
   * caption tokens. Structurally just a string (including empty) — an
   * empty caption is a semantic rule enforced by `validate()`, not a
   * structural one, for the same reason `duration` isn't constrained above.
   */
  caption: z.string().optional(),
  /** A static, decorative wrapper around this scene's visual content. */
  frame: sceneFrameSchema.optional(),
  /** Overlays the active brand's logo on this scene. */
  logo: sceneLogoSchema.optional(),
  /** Semantic pan/zoom/crop intent, independent of `frame` — usable with or without one. Omitted = a fixed, centered cover-crop (equivalent to `{ type: "static" }` with a centered focal point). */
  motion: motionSchema.optional()
};

/** An A-roll scene: primary footage carrying its own audio. */
export const aRollSceneSchema = z.object({
  type: z.literal("a_roll"),
  ...sceneBaseSchema
});

/** Whether a B-roll scene continues the preceding A-roll's audio or is silent. */
export const bRollAudioSchema = z.enum(["continue", "muted"], {
  error: "audio must be one of: continue, muted"
});

/** A B-roll scene: supporting footage, audio defaults to continuing the preceding A-roll. */
export const bRollSceneSchema = z.object({
  type: z.literal("b_roll"),
  ...sceneBaseSchema,
  audio: bRollAudioSchema.default("continue")
});

/** A scene is either A-roll or B-roll, discriminated on `type`. */
export const sceneSchema = z.discriminatedUnion("type", [aRollSceneSchema, bRollSceneSchema]);

/** The Video Specification's schema version. A future version adds a new literal, not a mutation of this one. */
export const videoSpecVersionSchema = z.literal("1");

/** The Video Specification document. */
export const videoSpecSchema = z
  .object({
    version: videoSpecVersionSchema,
    format: videoFormatSchema,
    fps: z.number().positive("fps must be a positive number"),
    /**
     * The brand id this specification renders against, resolved via
     * `../brand/registry.ts`'s `findBrand`/`loadBrand`. Defaults to
     * `"default"` — MotionKit's one built-in brand — when omitted, so
     * every Phase 1 specification (which predates the brand system)
     * keeps working unchanged.
     */
    brand: z.string().min(1).default("default"),
    scenes: z.array(sceneSchema).min(1, "At least one scene is required")
  })
  .check((ctx) => {
    const firstScene = ctx.value.scenes[0];
    if (firstScene?.transition) {
      ctx.issues.push({
        code: "custom",
        message:
          "The first scene may not declare a transition — there is nothing to transition from.",
        path: ["scenes", 0, "transition"],
        input: ctx.value
      });
    }
  });

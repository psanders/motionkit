/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * The Video Specification schema — a structured, versioned document
 * describing a video as data: an output format, a frame rate, and an
 * ordered timeline of scenes. This is the contract between the
 * creative/AI layer and the MotionKit rendering engine.
 */
import { z } from "zod/v4";

/** The output formats supported by MotionKit in this phase. */
export const videoFormatSchema = z.enum(["16:9", "9:16"], {
  error: "Format must be one of: 16:9, 9:16"
});

/** The transition types supported by MotionKit in this phase. */
export const transitionSchema = z.object({
  type: z.enum(["fade"], { error: "Transition type must be one of: fade" })
});

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
  transition: transitionSchema.optional()
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

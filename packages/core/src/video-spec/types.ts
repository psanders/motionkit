/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Inferred TypeScript types for the Video Specification schema.
 */
import type { z } from "zod/v4";
import type {
  aRollSceneSchema,
  bRollAudioSchema,
  bRollSceneSchema,
  sceneSchema,
  transitionSchema,
  videoFormatSchema,
  videoSpecSchema
} from "./schema.js";

export type VideoFormat = z.infer<typeof videoFormatSchema>;
export type Transition = z.infer<typeof transitionSchema>;
export type ARollScene = z.infer<typeof aRollSceneSchema>;
export type BRollAudio = z.infer<typeof bRollAudioSchema>;
export type BRollScene = z.infer<typeof bRollSceneSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type VideoSpec = z.infer<typeof videoSpecSchema>;

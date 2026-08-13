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
  focalPointSchema,
  motionSchema,
  overlaySchema,
  pipOverlaySchema,
  sceneFrameSchema,
  sceneLogoSchema,
  sceneSchema,
  transitionSchema,
  videoFormatSchema,
  videoSpecSchema
} from "./schema.js";

export type VideoFormat = z.infer<typeof videoFormatSchema>;
export type Transition = z.infer<typeof transitionSchema>;
export type SceneFrame = z.infer<typeof sceneFrameSchema>;
export type SceneLogo = z.infer<typeof sceneLogoSchema>;
export type FocalPoint = z.infer<typeof focalPointSchema>;
export type Motion = z.infer<typeof motionSchema>;
export type ARollScene = z.infer<typeof aRollSceneSchema>;
export type BRollAudio = z.infer<typeof bRollAudioSchema>;
export type BRollScene = z.infer<typeof bRollSceneSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type PipOverlay = z.infer<typeof pipOverlaySchema>;
export type Overlay = z.infer<typeof overlaySchema>;
export type VideoSpec = z.infer<typeof videoSpecSchema>;

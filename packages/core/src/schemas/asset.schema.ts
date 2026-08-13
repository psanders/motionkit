/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Schemas for MotionKit's asset system — video/audio/image/font assets that a
 * Video Specification references by name. This is the pattern-proving worked
 * example for the bootstrap: schemas live here in `@motionkit/core` alongside
 * their inferred types, so the MCP server, the CLI, and the render pipeline
 * all import the exact same source of truth.
 */
import { z } from "zod/v4";

/** The kinds of media MotionKit can register as an asset. */
export const assetTypeSchema = z.enum(["video", "audio", "image", "font"], {
  error: "Type must be one of: video, audio, image, font"
});

/** Schema for registering a new asset. */
export const createAssetSchema = z.object({
  name: z.string().min(1, "Name is required").transform((v) => v.trim()),
  type: assetTypeSchema,
  path: z.string().min(1, "Path is required"),
  tags: z.array(z.string()).default([])
});

/** Schema for updating an existing asset (only mutable fields). */
export const updateAssetSchema = z.object({
  name: z.string(),
  path: z.string().min(1).optional(),
  tags: z.array(z.string()).optional()
});

export type AssetType = z.infer<typeof assetTypeSchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type Asset = CreateAssetInput;

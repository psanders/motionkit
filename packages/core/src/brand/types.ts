/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Inferred TypeScript types for the Brand schema.
 */
import type { z } from "zod/v4";
import type { brandSchema, placementSchema } from "./schema.js";

export type Placement = z.infer<typeof placementSchema>;
export type Brand = z.infer<typeof brandSchema>;

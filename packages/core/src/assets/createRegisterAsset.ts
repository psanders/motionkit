/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Reference implementation of THE validated-function pattern, applied to
 * MotionKit's asset system. See `/ps:create-validated-function` for the
 * full write-up of the pattern this file demonstrates.
 */
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation.js";
import { createAssetSchema, type Asset, type CreateAssetInput } from "../schemas/asset.schema.js";
import { logger } from "../logger.js";

/** Minimal storage contract — injected so tests never touch a real store. */
export interface AssetStore {
  save(asset: Asset): Promise<Asset>;
}

/** An in-memory `AssetStore` backed by a `Map`, useful for local dev and tests. */
export function createInMemoryAssetStore(map: Map<string, Asset> = new Map()): AssetStore {
  return {
    async save(asset: Asset): Promise<Asset> {
      map.set(asset.name, asset);
      return asset;
    }
  };
}

export interface RegisterAssetDeps {
  store: AssetStore;
}

/**
 * Creates a function that validates and registers a new asset.
 *
 * @param deps - Injected dependencies (an `AssetStore`)
 * @returns A validated function that registers an asset
 */
export function createRegisterAsset(deps: RegisterAssetDeps) {
  const fn = async (params: CreateAssetInput): Promise<Asset> => {
    logger.verbose("registering asset", { name: params.name, type: params.type });
    const asset = await deps.store.save(params);
    logger.verbose("asset registered", { name: asset.name });
    return asset;
  };

  return withErrorHandlingAndValidation(fn, createAssetSchema);
}

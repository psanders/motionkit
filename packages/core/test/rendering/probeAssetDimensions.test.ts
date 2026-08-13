/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Exercises the real `ffprobe` shell-out against a known-resolution
 * synthetic fixture — consistent with this suite's convention of not
 * mocking the ffmpeg toolchain (see `render.test.ts`).
 */
import { expect } from "chai";
import fs from "node:fs";
import {
  checkSourceRangeFitsAsset,
  clearAssetDimensionsCache,
  clearAssetDurationCache,
  probeAssetDimensions,
  probeAssetDurationSeconds
} from "../../src/rendering/probeAssetDimensions.js";
import { generateSampleVideo } from "../fixtures/generateSampleVideo.js";

describe("probeAssetDimensions", () => {
  beforeEach(() => {
    clearAssetDimensionsCache();
  });

  it("should return the fixture's actual video dimensions", () => {
    // Arrange
    const fixturePath = generateSampleVideo({
      name: "probe-dimensions.mp4",
      duration: 1,
      width: 400,
      height: 200
    });

    // Act
    const dimensions = probeAssetDimensions(fixturePath);

    // Assert
    expect(dimensions).to.deep.equal({ width: 400, height: 200 });
  });

  it("should cache a probed path, not re-shelling out to ffprobe on a second call", () => {
    // Arrange
    const fixturePath = generateSampleVideo({
      name: "probe-dimensions-cache.mp4",
      duration: 1,
      width: 320,
      height: 240
    });
    probeAssetDimensions(fixturePath);
    // If the second call re-invoked ffprobe against a now-missing file, it
    // would throw — deleting the file is a black-box way to prove the cache
    // hit without stubbing `child_process` directly (this suite's
    // convention is to exercise the real ffmpeg toolchain, not mock it).
    fs.rmSync(fixturePath);

    // Act
    const dimensions = probeAssetDimensions(fixturePath);

    // Assert
    expect(dimensions).to.deep.equal({ width: 320, height: 240 });
  });

  it("should re-probe a path after the cache is cleared", () => {
    // Arrange
    const fixturePath = generateSampleVideo({
      name: "probe-dimensions-clear.mp4",
      duration: 1,
      width: 160,
      height: 90
    });
    probeAssetDimensions(fixturePath);
    clearAssetDimensionsCache();
    fs.rmSync(fixturePath);

    // Act / Assert — the file is gone and the cache was cleared, so this
    // must genuinely re-shell out and fail.
    expect(() => probeAssetDimensions(fixturePath)).to.throw();
  });
});

describe("probeAssetDurationSeconds", () => {
  beforeEach(() => {
    clearAssetDurationCache();
  });

  it("should return the fixture's actual duration", () => {
    // Arrange
    const fixturePath = generateSampleVideo({ name: "probe-duration.mp4", duration: 2 });

    // Act
    const durationSeconds = probeAssetDurationSeconds(fixturePath);

    // Assert
    expect(durationSeconds).to.be.closeTo(2, 0.2);
  });

  it("should cache a probed path, not re-shelling out to ffprobe on a second call", () => {
    // Arrange
    const fixturePath = generateSampleVideo({ name: "probe-duration-cache.mp4", duration: 1.5 });
    const first = probeAssetDurationSeconds(fixturePath);
    // Same black-box cache-hit proof `probeAssetDimensions`'s own cache test
    // uses: delete the file, then confirm the second call still succeeds.
    fs.rmSync(fixturePath);

    // Act
    const second = probeAssetDurationSeconds(fixturePath);

    // Assert
    expect(second).to.equal(first);
  });

  it("should re-probe a path after the cache is cleared", () => {
    // Arrange
    const fixturePath = generateSampleVideo({ name: "probe-duration-clear.mp4", duration: 1 });
    probeAssetDurationSeconds(fixturePath);
    clearAssetDurationCache();
    fs.rmSync(fixturePath);

    // Act / Assert
    expect(() => probeAssetDurationSeconds(fixturePath)).to.throw();
  });
});

describe("checkSourceRangeFitsAsset", () => {
  beforeEach(() => {
    clearAssetDurationCache();
  });

  it("should return null when neither source field is declared", () => {
    // Arrange
    const fixturePath = generateSampleVideo({ name: "range-neither.mp4", duration: 3 });

    // Act
    const error = checkSourceRangeFitsAsset({
      assetPath: fixturePath,
      durationSeconds: 1,
      itemPath: "scenes.0"
    });

    // Assert
    expect(error).to.equal(null);
  });

  it("should return null when the source range fits the asset and covers the duration", () => {
    // Arrange
    const fixturePath = generateSampleVideo({ name: "range-fits.mp4", duration: 3 });

    // Act
    const error = checkSourceRangeFitsAsset({
      assetPath: fixturePath,
      sourceStartSeconds: 0.5,
      sourceEndSeconds: 2.5,
      durationSeconds: 1,
      itemPath: "scenes.0"
    });

    // Assert
    expect(error).to.equal(null);
  });

  it("should reject a sourceStartSeconds at or beyond the asset's real duration", () => {
    // Arrange
    const fixturePath = generateSampleVideo({ name: "range-start-beyond.mp4", duration: 1 });

    // Act
    const error = checkSourceRangeFitsAsset({
      assetPath: fixturePath,
      sourceStartSeconds: 5,
      durationSeconds: 1,
      itemPath: "scenes.2"
    });

    // Assert
    expect(error).to.not.equal(null);
    expect(error?.code).to.equal("SOURCE_RANGE_EXCEEDS_ASSET_DURATION");
    expect(error?.path).to.equal("scenes.2.sourceStartSeconds");
  });

  it("should reject a source range too short to cover the declared duration", () => {
    // Arrange — a 3s asset with a 0.5s window requested to cover a 2s scene
    const fixturePath = generateSampleVideo({ name: "range-too-short.mp4", duration: 3 });

    // Act
    const error = checkSourceRangeFitsAsset({
      assetPath: fixturePath,
      sourceStartSeconds: 1,
      sourceEndSeconds: 1.5,
      durationSeconds: 2,
      itemPath: "overlays.0"
    });

    // Assert
    expect(error).to.not.equal(null);
    expect(error?.code).to.equal("SOURCE_RANGE_EXCEEDS_ASSET_DURATION");
    expect(error?.path).to.equal("overlays.0");
  });

  it("should reject a range whose sourceEndSeconds reaches past the asset's real end, when too short for duration", () => {
    // Arrange — a 1s asset, sourceEndSeconds declared well past its real end
    const fixturePath = generateSampleVideo({ name: "range-end-beyond.mp4", duration: 1 });

    // Act
    const error = checkSourceRangeFitsAsset({
      assetPath: fixturePath,
      sourceStartSeconds: 0.2,
      sourceEndSeconds: 10,
      durationSeconds: 5,
      itemPath: "scenes.0"
    });

    // Assert — capped at the asset's real end (~1s), leaving ~0.8s, short of the 5s duration
    expect(error).to.not.equal(null);
    expect(error?.code).to.equal("SOURCE_RANGE_EXCEEDS_ASSET_DURATION");
  });
});

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
  clearAssetDimensionsCache,
  probeAssetDimensions
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

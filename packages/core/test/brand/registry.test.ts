/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 */
import { execFileSync } from "node:child_process";
import { expect } from "chai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { findBrand, loadBrand } from "../../src/brand/registry.js";
import type { Brand } from "../../src/brand/types.js";

function customBrand(): Brand {
  return {
    colors: {
      primary: "#000000",
      secondary: "#111111",
      background: "#222222",
      text: "#ffffff",
      accent: "#ff00ff"
    },
    typography: {
      fontFamily: "Inter, sans-serif",
      sizes: { title: 64, subtitle: 32, caption: 24, cta: 28 }
    },
    logo: { asset: "acme-logo.svg", defaultPosition: "top_left" },
    spacing: { sm: 4, md: 8, lg: 16 },
    borderRadius: { sm: 2, md: 4, lg: 8 },
    shadows: { sm: "none", md: "none", lg: "none" },
    captionStyle: { fontSize: 24, color: "#ffffff", backgroundColor: "rgba(0,0,0,0.5)" },
    titleStyle: { fontSize: 64, color: "#ffffff", fontWeight: "800" },
    lowerThirdStyle: { backgroundColor: "#111111", textColor: "#ffffff", fontSize: 28 },
    browserFrameStyle: {
      chromeColor: "#111111",
      chromeHeightPx: 32,
      borderRadius: 8,
      shadow: "none"
    },
    phoneFrameStyle: {
      chromeColor: "#111111",
      chromeHeightPx: 24,
      borderRadius: 28,
      shadow: "none"
    },
    pipStyle: {
      size: { sm: 130, md: 200, lg: 300 },
      borderWidth: 3,
      borderColor: "#ffffff",
      shadow: "none",
      defaultPosition: "bottom_left"
    },
    ctaStyle: { backgroundColor: "#000000", textColor: "#ffffff", fontSize: 28, borderRadius: 4 },
    defaultTransitionDurationSeconds: 0.75
  };
}

describe("brand registry", () => {
  let specDir: string;

  beforeEach(() => {
    specDir = fs.mkdtempSync(path.join(os.tmpdir(), "motionkit-brand-registry-"));
  });

  afterEach(() => {
    fs.rmSync(specDir, { recursive: true, force: true });
  });

  it("should resolve the built-in 'default' brand with no spec-dir setup", () => {
    // Act
    const result = findBrand("default", specDir);

    // Assert
    expect(result.found).to.equal(true);
    if (result.found) {
      expect(result.brand.logo.defaultPosition).to.be.a("string");
      expect(result.brandDir.endsWith(path.join("brand", "brands"))).to.equal(true);
    }
  });

  it("should resolve a brand from the spec directory's brands/ folder, preferring it over the built-in", () => {
    // Arrange
    const brandsDir = path.join(specDir, "brands");
    fs.mkdirSync(brandsDir, { recursive: true });
    fs.writeFileSync(path.join(brandsDir, "acme.brand.json"), JSON.stringify(customBrand()));

    // Act
    const result = findBrand("acme", specDir);

    // Assert
    expect(result.found).to.equal(true);
    if (result.found) {
      expect(result.brand.logo.defaultPosition).to.equal("top_left");
      expect(result.brandDir).to.equal(brandsDir);
    }
  });

  it("should report an unknown brand id without throwing, listing available ids", () => {
    // Arrange
    const brandsDir = path.join(specDir, "brands");
    fs.mkdirSync(brandsDir, { recursive: true });
    fs.writeFileSync(path.join(brandsDir, "acme.brand.json"), JSON.stringify(customBrand()));

    // Act
    const result = findBrand("does-not-exist", specDir);

    // Assert
    expect(result.found).to.equal(false);
    if (!result.found) {
      expect(result.availableIds).to.include("default");
      expect(result.availableIds).to.include("acme");
    }
  });

  it("should never throw for an unknown brand id", () => {
    // Act + Assert
    expect(() => findBrand("does-not-exist", specDir)).to.not.throw();
  });

  it("should return a valid brand and brandDir via loadBrand for a known id", () => {
    // Act
    const { brand, brandDir } = loadBrand("default", specDir);

    // Assert
    expect(brand.defaultTransitionDurationSeconds).to.be.a("number");
    expect(fs.existsSync(brandDir)).to.equal(true);
  });

  it("should throw via loadBrand for an unknown id", () => {
    // Act + Assert
    expect(() => loadBrand("does-not-exist", specDir)).to.throw(/Unknown brand/);
  });
});

describe("brand registry — built package output", function () {
  // A full `tsc -b` is slow the first time; it's incremental after that
  // (skipped entirely if this workspace was already built by an outer
  // `npm run build`/`npm run typecheck`), but give it room regardless.
  this.timeout(120_000);

  const CORE_ROOT = path.resolve(import.meta.dirname, "../..");
  const DIST_BRANDS_DIR = path.join(CORE_ROOT, "dist/brand/brands");
  const DIST_REGISTRY_MODULE = path.join(CORE_ROOT, "dist/brand/registry.js");

  before(() => {
    execFileSync("npx", ["tsc", "-b"], { cwd: CORE_ROOT, stdio: "pipe" });
    execFileSync("npm", ["run", "copy:brand-assets"], { cwd: CORE_ROOT, stdio: "pipe" });
  });

  it("should copy default.brand.json into dist/brand/brands", () => {
    // Assert
    expect(fs.existsSync(path.join(DIST_BRANDS_DIR, "default.brand.json"))).to.equal(true);
  });

  it("should resolve the 'default' brand from the compiled dist output, not just from src/", async () => {
    // Arrange
    const { findBrand: findBrandFromDist } = (await import(
      pathToFileURL(DIST_REGISTRY_MODULE).href
    )) as typeof import("../../src/brand/registry.js");
    const tmpSpecDir = fs.mkdtempSync(path.join(os.tmpdir(), "motionkit-brand-dist-"));

    // Act
    const result = findBrandFromDist("default", tmpSpecDir);

    // Assert
    expect(result.found).to.equal(true);
    if (result.found) {
      expect(result.brandDir).to.equal(DIST_BRANDS_DIR);
    }

    fs.rmSync(tmpSpecDir, { recursive: true, force: true });
  });
});

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 */
import { expect } from "chai";
import { brandSchema } from "../../src/brand/schema.js";
import type { Brand } from "../../src/brand/types.js";

function wellFormedBrand(): Brand {
  return {
    colors: {
      primary: "#4F46E5",
      secondary: "#1E293B",
      background: "#0F172A",
      text: "#F8FAFC",
      accent: "#22D3EE"
    },
    typography: {
      fontFamily: "system-ui, sans-serif",
      sizes: { title: 72, subtitle: 40, caption: 32, cta: 36 }
    },
    logo: { asset: "logo.svg", defaultPosition: "bottom_right" },
    spacing: { sm: 8, md: 16, lg: 32 },
    borderRadius: { sm: 4, md: 8, lg: 16 },
    shadows: {
      sm: "0 1px 2px rgba(0,0,0,0.3)",
      md: "0 4px 8px rgba(0,0,0,0.35)",
      lg: "0 12px 24px rgba(0,0,0,0.4)"
    },
    captionStyle: { fontSize: 32, color: "#F8FAFC", backgroundColor: "rgba(15,23,42,0.75)" },
    titleStyle: { fontSize: 72, color: "#F8FAFC", fontWeight: "700" },
    lowerThirdStyle: { backgroundColor: "#1E293B", textColor: "#F8FAFC", fontSize: 36 },
    browserFrameStyle: {
      chromeColor: "#1E293B",
      chromeHeightPx: 40,
      borderRadius: 12,
      shadow: "0 12px 24px rgba(0,0,0,0.4)"
    },
    phoneFrameStyle: {
      chromeColor: "#1E293B",
      chromeHeightPx: 28,
      borderRadius: 32,
      shadow: "0 12px 24px rgba(0,0,0,0.4)"
    },
    ctaStyle: { backgroundColor: "#4F46E5", textColor: "#F8FAFC", fontSize: 36, borderRadius: 8 },
    defaultTransitionDurationSeconds: 0.5
  };
}

describe("brandSchema", () => {
  it("should accept a well-formed brand document", () => {
    // Act
    const result = brandSchema.safeParse(wellFormedBrand());

    // Assert
    expect(result.success).to.equal(true);
  });

  const requiredCategories: (keyof Brand)[] = [
    "colors",
    "typography",
    "logo",
    "spacing",
    "borderRadius",
    "shadows",
    "captionStyle",
    "titleStyle",
    "lowerThirdStyle",
    "browserFrameStyle",
    "phoneFrameStyle",
    "ctaStyle",
    "defaultTransitionDurationSeconds"
  ];

  for (const category of requiredCategories) {
    it(`should reject a document missing '${category}'`, () => {
      // Arrange
      const doc = wellFormedBrand() as Record<string, unknown>;
      delete doc[category];

      // Act
      const result = brandSchema.safeParse(doc);

      // Assert
      expect(result.success).to.equal(false);
    });
  }
});

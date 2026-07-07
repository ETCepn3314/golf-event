import { describe, expect, it } from "vitest";
import {
  brandingStyle,
  DEFAULT_ACCENT,
  DEFAULT_BRAND,
  hexToHsl,
  hslToHex,
  isHexColor,
  resolveBranding,
  THEME_PRESETS,
} from "./branding";

describe("hex/hsl round-trip", () => {
  it("preserves known colors within rounding", () => {
    for (const hex of ["#0f2a1f", "#a8863c", "#14243f", "#ffffff", "#000000", "#3a1520"]) {
      expect(hslToHex(hexToHsl(hex))).toBe(hex);
    }
  });
});

describe("isHexColor", () => {
  it("accepts 6-digit hex only", () => {
    expect(isHexColor("#a8863c")).toBe(true);
    expect(isHexColor("#ABC")).toBe(false);
    expect(isHexColor("a8863c")).toBe(false);
    expect(isHexColor(undefined)).toBe(false);
    expect(isHexColor("red")).toBe(false);
  });
});

describe("resolveBranding", () => {
  it("falls back to defaults for missing or bad input", () => {
    expect(resolveBranding(undefined)).toMatchObject({ brand: DEFAULT_BRAND, accent: DEFAULT_ACCENT });
    expect(resolveBranding({ brandColor: "nope", accentColor: "" })).toMatchObject({
      brand: DEFAULT_BRAND,
      accent: DEFAULT_ACCENT,
    });
  });

  it("clamps a too-light brand into the dark band so board text stays readable", () => {
    const { brand } = resolveBranding({ brandColor: "#ffffff" });
    expect(hexToHsl(brand).l).toBeLessThanOrEqual(31); // 30 + hex rounding
  });

  it("clamps a too-dark accent up into the mid band", () => {
    const { accent } = resolveBranding({ accentColor: "#000000" });
    expect(hexToHsl(accent).l).toBeGreaterThanOrEqual(40);
  });

  it("trims and passes through a logo url, dropping blanks", () => {
    expect(resolveBranding({ logoUrl: "  https://x/y.png " }).logoUrl).toBe("https://x/y.png");
    expect(resolveBranding({ logoUrl: "   " }).logoUrl).toBeUndefined();
  });
});

describe("brandingStyle", () => {
  it("is empty for the default theme (built-in tokens apply)", () => {
    expect(brandingStyle(undefined)).toEqual({});
    expect(brandingStyle({ brandColor: DEFAULT_BRAND, accentColor: DEFAULT_ACCENT })).toEqual({});
  });

  it("emits the five palette variables for a custom theme", () => {
    const vars = brandingStyle({ brandColor: "#14243f", accentColor: "#c2a24e" });
    expect(Object.keys(vars).sort()).toEqual(
      ["--color-brass", "--color-brass-light", "--color-fern", "--color-moss", "--color-pine"].sort()
    );
    expect(vars["--color-pine"]).toBe("#14243f");
    // brass-light is a lighter shade of the accent
    expect(hexToHsl(vars["--color-brass-light"]).l).toBeGreaterThan(hexToHsl(vars["--color-brass"]).l);
  });
});

describe("presets", () => {
  it("are all valid hex and the first reproduces the default look", () => {
    for (const p of THEME_PRESETS) {
      expect(isHexColor(p.brandColor)).toBe(true);
      expect(isHexColor(p.accentColor)).toBe(true);
    }
    expect(THEME_PRESETS[0]).toMatchObject({ brandColor: DEFAULT_BRAND, accentColor: DEFAULT_ACCENT });
    expect(brandingStyle(THEME_PRESETS[0])).toEqual({});
  });
});

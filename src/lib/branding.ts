/**
 * Per-event theming. An organizer picks a deep "brand" color (the boards and
 * headers) and a metallic "accent" (highlights, purse figures, position marks),
 * optionally with a logo. Everything else in the palette is derived from those
 * two, so the whole event experience re-skins from a single choice.
 *
 * Pure module — no React, no DOM, no Next. `brandingStyle` returns plain CSS
 * custom-property overrides that the app's Tailwind tokens already read from
 * (e.g. `bg-pine` compiles to `background: var(--color-pine)`), so setting the
 * variables on a wrapper element re-themes everything beneath it.
 */

export interface Branding {
  /** Preset id, or "custom" when the colors were hand-picked. */
  themeId?: string;
  /** Deep primary — the scoreboards, hero panels, headings. */
  brandColor?: string;
  /** Metallic highlight — purse figures, position marks, rules callouts. */
  accentColor?: string;
  /** Optional hosted logo image shown on the public board. */
  logoUrl?: string;
}

export interface ThemePreset {
  id: string;
  label: string;
  brandColor: string;
  accentColor: string;
}

/** The palette the app ships with — kept identical to the default tokens. */
export const DEFAULT_BRAND = "#0f2a1f";
export const DEFAULT_ACCENT = "#a8863c";

/**
 * Curated, professional pairings. The first (Heritage) reproduces the built-in
 * clubhouse look exactly; the rest keep a deep brand + warm-metal accent so the
 * cream board text and gold figures stay legible on every one.
 */
export const THEME_PRESETS: ThemePreset[] = [
  { id: "heritage", label: "Heritage green", brandColor: DEFAULT_BRAND, accentColor: DEFAULT_ACCENT },
  { id: "midnight", label: "Midnight navy", brandColor: "#14243f", accentColor: "#c2a24e" },
  { id: "bordeaux", label: "Bordeaux", brandColor: "#3a1520", accentColor: "#c49a4a" },
  { id: "fairway", label: "Fairway", brandColor: "#123a2a", accentColor: "#b7a13c" },
  { id: "slate", label: "Slate & copper", brandColor: "#1f242a", accentColor: "#cf8f46" },
  { id: "ocean", label: "Deep ocean", brandColor: "#0c2c34", accentColor: "#c9a24e" },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: string | undefined | null): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

interface Hsl {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export function hexToHsl(hex: string): Hsl {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to255 = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}

/** Same hue and saturation, lightness shifted by `delta` (clamped to a range). */
function shift(hex: string, delta: number, lo = 0, hi = 100): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, l: clamp(hsl.l + delta, lo, hi) });
}

/**
 * Resolve a stored branding blob to the two working colors, filling defaults and
 * ignoring anything malformed. Also clamps the brand into a dark band and the
 * accent into a mid band so board text (cream) and figures stay readable no
 * matter what a user picks.
 */
export function resolveBranding(b?: Branding | null): {
  brand: string;
  accent: string;
  logoUrl?: string;
} {
  const rawBrand = isHexColor(b?.brandColor) ? b!.brandColor : DEFAULT_BRAND;
  const rawAccent = isHexColor(b?.accentColor) ? b!.accentColor : DEFAULT_ACCENT;

  const brandHsl = hexToHsl(rawBrand);
  const accentHsl = hexToHsl(rawAccent);

  const brand = hslToHex({ ...brandHsl, l: clamp(brandHsl.l, 8, 30) });
  const accent = hslToHex({ ...accentHsl, l: clamp(accentHsl.l, 40, 56) });

  return {
    brand,
    accent,
    logoUrl: typeof b?.logoUrl === "string" && b.logoUrl.trim() ? b.logoUrl.trim() : undefined,
  };
}

/**
 * CSS custom-property overrides for an event's theme. Spread onto the `style` of
 * a wrapper element. Returns an empty object for the default theme so the
 * built-in tokens apply untouched.
 */
export function brandingStyle(b?: Branding | null): Record<`--${string}`, string> {
  const { brand, accent } = resolveBranding(b);
  if (brand === DEFAULT_BRAND && accent === DEFAULT_ACCENT) return {};
  return {
    "--color-pine": brand,
    "--color-moss": shift(brand, 8, 8, 40),
    "--color-fern": shift(brand, 18, 12, 48),
    "--color-brass": accent,
    "--color-brass-light": shift(accent, 16, 56, 74),
  };
}

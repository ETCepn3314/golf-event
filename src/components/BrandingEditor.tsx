"use client";

import { BrandLogo } from "@/components/ui";
import {
  type Branding,
  brandingStyle,
  DEFAULT_ACCENT,
  DEFAULT_BRAND,
  isHexColor,
  THEME_PRESETS,
} from "@/lib/branding";

/** The wizard/admin working shape — colors are always concrete strings here. */
export interface BrandingDraft {
  themeId?: string;
  brandColor: string;
  accentColor: string;
  logoUrl: string;
}

export function defaultBrandingDraft(): BrandingDraft {
  return { themeId: "heritage", brandColor: DEFAULT_BRAND, accentColor: DEFAULT_ACCENT, logoUrl: "" };
}

export function brandingConfigToDraft(b?: Branding | null): BrandingDraft {
  return {
    themeId: b?.themeId ?? (b?.brandColor || b?.accentColor ? "custom" : "heritage"),
    brandColor: isHexColor(b?.brandColor) ? b!.brandColor! : DEFAULT_BRAND,
    accentColor: isHexColor(b?.accentColor) ? b!.accentColor! : DEFAULT_ACCENT,
    logoUrl: b?.logoUrl ?? "",
  };
}

/**
 * Reduce the draft to what gets stored on the event. The default Heritage theme
 * with no logo stores nothing, so untouched events keep a clean config and the
 * built-in tokens apply.
 */
export function brandingDraftToConfig(d: BrandingDraft): Branding | undefined {
  const isDefault =
    (d.themeId ?? "heritage") === "heritage" &&
    d.brandColor === DEFAULT_BRAND &&
    d.accentColor === DEFAULT_ACCENT &&
    !d.logoUrl.trim();
  if (isDefault) return undefined;

  const out: Branding = { themeId: d.themeId };
  if (isHexColor(d.brandColor)) out.brandColor = d.brandColor;
  if (isHexColor(d.accentColor)) out.accentColor = d.accentColor;
  if (d.logoUrl.trim()) out.logoUrl = d.logoUrl.trim();
  return out;
}

export function BrandingEditor({
  value,
  onChange,
}: {
  value: BrandingDraft;
  onChange: (next: BrandingDraft) => void;
}) {
  const logoInvalid = value.logoUrl.trim() !== "" && !/^https?:\/\/.+/i.test(value.logoUrl.trim());

  return (
    <div className="space-y-5">
      <div>
        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
          Theme
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEME_PRESETS.map((p) => {
            const selected =
              value.themeId === p.id ||
              (value.brandColor === p.brandColor && value.accentColor === p.accentColor);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    themeId: p.id,
                    brandColor: p.brandColor,
                    accentColor: p.accentColor,
                  })
                }
                className={`flex items-center gap-2.5 rounded-sm border p-2.5 text-left transition-colors ${
                  selected ? "border-pine ring-1 ring-pine" : "border-ink/15 hover:border-ink/35"
                }`}
              >
                <span className="flex shrink-0">
                  <span
                    className="h-7 w-7 rounded-l-sm border border-black/10"
                    style={{ background: p.brandColor }}
                  />
                  <span
                    className="h-7 w-4 rounded-r-sm border border-l-0 border-black/10"
                    style={{ background: p.accentColor }}
                  />
                </span>
                <span className="text-[12px] font-semibold leading-tight text-ink">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
          Custom colors
        </span>
        <div className="grid grid-cols-2 gap-3">
          <SwatchInput
            label="Brand"
            value={value.brandColor}
            onChange={(c) => onChange({ ...value, themeId: "custom", brandColor: c })}
          />
          <SwatchInput
            label="Accent"
            value={value.accentColor}
            onChange={(c) => onChange({ ...value, themeId: "custom", accentColor: c })}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-putty">
          Brand fills the scoreboards; accent picks out the purse and positions. Both are auto-tuned
          for readable board text.
        </p>
      </div>

      <div>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
            Logo URL (optional)
          </span>
          <input
            placeholder="https://example.com/logo.png"
            className="w-full rounded-sm border border-ink/20 bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-putty/70 focus:border-brass focus:outline-none"
            value={value.logoUrl}
            onChange={(e) => onChange({ ...value, logoUrl: e.target.value })}
          />
        </label>
        {logoInvalid && (
          <p className="mt-1 text-[12px] text-clay">
            Enter a full image link starting with http:// or https://
          </p>
        )}
        <p className="mt-1.5 text-[11px] text-putty">
          Paste a link to a hosted PNG or SVG (e.g. your club crest). It shows on the leaderboard.
        </p>
      </div>

      <div>
        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
          Preview
        </span>
        <div
          className="board-texture overflow-hidden rounded-md bg-pine p-4 text-cream"
          style={brandingStyle({
            brandColor: value.brandColor,
            accentColor: value.accentColor,
          })}
        >
          {!logoInvalid && value.logoUrl.trim() && (
            <BrandLogo url={value.logoUrl.trim()} className="mb-3 h-10 max-w-[50%]" />
          )}
          <div className="text-[10px] uppercase tracking-[0.2em] text-cream/60">
            Official leaderboard
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-cream/15 pt-2.5">
            <span className="font-display text-lg font-semibold text-brass-light">1</span>
            <span className="text-[13px] font-semibold tracking-wide">Sample Team</span>
            <span className="font-display text-lg font-semibold text-[#ff8a70]">−4</span>
            <span className="text-[13px] font-semibold text-brass-light">$250</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SwatchInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const safe = isHexColor(value) ? value : "#000000";
  return (
    <div>
      <span className="mb-1 block text-[11px] text-putty">{label}</span>
      <div className="flex items-center gap-2 rounded-sm border border-ink/20 bg-paper p-1.5">
        <input
          type="color"
          aria-label={`${label} color`}
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-9 shrink-0 cursor-pointer rounded-sm border-0 bg-transparent p-0"
        />
        <input
          aria-label={`${label} hex`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="w-full min-w-0 bg-transparent font-mono text-[13px] uppercase text-ink focus:outline-none"
        />
      </div>
    </div>
  );
}

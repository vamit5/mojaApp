import type { CSSProperties } from "react";
import type { AppConfig } from "@mojapp/core";
import { luminance, mix, onColor } from "@mojapp/ui";

const FONTS: Record<AppConfig["brand"]["fonts"], { display: string; body: string; weight: number; stretch: string; tracking: string }> = {
  modern:    { display: "'Manrope', system-ui, sans-serif",          body: "'Manrope', system-ui, sans-serif", weight: 800, stretch: "100%", tracking: "-0.02em" },
  editorial: { display: "'Fraunces', Georgia, serif",                body: "'Manrope', system-ui, sans-serif", weight: 600, stretch: "100%", tracking: "-0.01em" },
  bold:      { display: "'Archivo', system-ui, sans-serif",          body: "'Archivo', system-ui, sans-serif", weight: 800, stretch: "118%", tracking: "-0.01em" },
};

const RADIUS = { sharp: 6, soft: 14, round: 24 } as const;

/** Pretvara config u CSS varijable. Promena boje = promena par varijabli, bez re-rendera stabla. */
export function themeVars(brand: AppConfig["brand"], modeOverride?: "light" | "dark"): CSSProperties {
  const mode = modeOverride ?? brand.mode;
  const { primary, secondary } = brand.colors;
  const darkSecondary = luminance(secondary) < 0.12;
  const f = FONTS[brand.fonts];
  const r = RADIUS[brand.radius];

  const light = {
    bg: mix("#FFFFFF", darkSecondary ? secondary : "#1A1C20", 0.035),
    surface: "#FFFFFF",
    ink: darkSecondary ? mix(secondary, "#000000", 0.15) : "#17191E",
    ink2: darkSecondary ? mix(secondary, "#FFFFFF", 0.42) : "#62666F",
    line: mix("#FFFFFF", darkSecondary ? secondary : "#1A1C20", 0.1),
    soft: mix(primary, "#FFFFFF", 0.88),
  };
  const darkBg = darkSecondary ? mix(secondary, "#000000", 0.35) : "#121316";
  const dark = {
    bg: darkBg,
    surface: mix(darkBg, "#FFFFFF", 0.07),
    ink: "#F3F3F1",
    ink2: "#A3A6AD",
    line: mix(darkBg, "#FFFFFF", 0.13),
    soft: mix(primary, darkBg, 0.78),
  };
  const t = mode === "dark" ? dark : light;

  return {
    "--p": primary,
    "--p-on": onColor(primary),
    "--p-soft": t.soft,
    "--p-deep": mix(primary, "#000000", 0.25),
    "--s": secondary,
    "--s-on": onColor(secondary),
    "--bg": t.bg,
    "--surface": t.surface,
    "--ink": t.ink,
    "--ink-2": t.ink2,
    "--line": t.line,
    "--r": `${r}px`,
    "--r-sm": `${Math.max(4, Math.round(r * 0.6))}px`,
    "--r-lg": `${Math.round(r * 1.4)}px`,
    "--font-display": f.display,
    "--font-body": f.body,
    "--display-weight": f.weight,
    "--display-stretch": f.stretch,
    "--display-tracking": f.tracking,
    colorScheme: mode,
  } as CSSProperties;
}

export const fmtPrice = (v: number, currency = "RSD") =>
  `${new Intl.NumberFormat("sr-Latn-RS").format(v)} ${currency}`;

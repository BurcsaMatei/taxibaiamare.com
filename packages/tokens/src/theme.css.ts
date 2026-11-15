// packages/tokens/src/theme.css.ts

// ==============================
// Imports
// ==============================
import { createTheme, createThemeContract } from "@vanilla-extract/css";

// ==============================
// Contract (tokens) — strict, fără `any`
// ==============================
export const vars = createThemeContract({
  color: {
    bg: null,
    text: null,
    muted: null,
    border: null,

    primary: null,
    primaryHover: null,
    primaryContrast: null,

    overlay: null,
    surface: null,
    surfaceHover: null,
    surfaceActive: null,

    link: null,
    linkHover: null,
    focus: null,

    secondary: null,

    cardBg: null,
    cardText: null,

    // nuanțe translucide pentru rânduri de tabel: OK (verde) / eșec (roșu); se pun peste fundalul tabelului
    tintOk: null,
    tintFailed: null,

    shadow: null,
  },

  typography: {
    font: { base: null, heading: null, mono: null },
    size: { xs: null, sm: null, md: null, lg: null, xl: null, "2xl": null },
    weight: { regular: null, medium: null, semibold: null, bold: null },
    leading: { tight: null, normal: null, relaxed: null },
  },

  radius: { xs: null, sm: null, md: null, lg: null, xl: null },
  shadow: { sm: null, md: null, lg: null },
  z: { header: null, overlay: null, modal: null },
  space: { xs: null, sm: null, md: null, lg: null, xl: null, xxl: null },

  motion: {
    fast: null,
    normal: null,
    slow: null,
    easing: { standard: null, emphasized: null },
  },

  layout: { max: { md: null, lg: null, xl: null } },
});

// ==============================
// LIGHT THEME
// ==============================
export const themeClassLight = createTheme(vars, {
  color: {
    bg: "#ffffff",
    text: "#111111",
    muted: "rgba(0,0,0,0.6)",
    border: "rgba(0,0,0,0.12)",

    primary: "#5561F2",
    primaryHover: "#4956ea",
    primaryContrast: "#ffffff",

    overlay: "rgba(0,0,0,0.5)",

    surface: "#ffffff",
    surfaceHover: "rgba(0,0,0,0.04)",
    surfaceActive: "rgba(0,0,0,0.06)",

    link: "#5561F2",
    linkHover: "#4956ea",
    focus: "#0b5fff",

    secondary: "#A8D5BA",

    cardBg: "#ffffff",
    cardText: "#111111",

    tintOk: "rgba(46, 160, 67, 0.16)",
    tintFailed: "rgba(218, 54, 51, 0.14)",

    shadow: "rgb(0 0 0)",
  },

  typography: {
    font: {
      base: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      heading: "inherit",
      mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    },
    size: { xs: "12px", sm: "14px", md: "16px", lg: "18px", xl: "20px", "2xl": "24px" },
    weight: { regular: "400", medium: "500", semibold: "600", bold: "700" },
    leading: { tight: "1.25", normal: "1.5", relaxed: "1.7" },
  },

  radius: { xs: "6px", sm: "8px", md: "10px", lg: "12px", xl: "16px" },

  shadow: {
    sm: "0 1px 2px rgba(0,0,0,0.06)",
    md: "0 8px 18px -16px rgba(0,0,0,0.32)",
    lg: "-10px 0 24px rgba(0,0,0,.18)",
  },

  z: { header: "50", overlay: "1000", modal: "1100" },

  space: { xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "24px", xxl: "32px" },

  motion: {
    fast: "80ms",
    normal: "150ms",
    slow: "250ms",
    easing: { standard: "cubic-bezier(.2,0,.2,1)", emphasized: "cubic-bezier(.2,0,0,1)" },
  },

  layout: { max: { md: "1200px", lg: "1320px", xl: "1440px" } },
});

// ==============================
// DARK THEME
// ==============================
export const themeClassDark = createTheme(vars, {
  color: {
    bg: "#0b0b0d",
    text: "#f5f5f5",
    muted: "rgba(255,255,255,0.7)",
    border: "rgba(255,255,255,0.16)",

    primary: "#7b84ff",
    primaryHover: "#8b93ff",
    primaryContrast: "#0b0b0d",

    overlay: "rgba(0,0,0,0.6)",

    surface: "#111215",
    surfaceHover: "rgba(255,255,255,0.06)",
    surfaceActive: "rgba(255,255,255,0.10)",

    link: "#aab0ff",
    linkHover: "#c0c5ff",
    focus: "#9bc2ff",

    secondary: "#4a6e50",

    cardBg: "#111215",
    cardText: "#f5f5f5",

    tintOk: "rgba(63, 185, 80, 0.20)",
    tintFailed: "rgba(248, 81, 73, 0.22)",

    shadow: "rgb(0 0 0)",
  },

  typography: {
    font: {
      base: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      heading: "inherit",
      mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    },
    size: { xs: "12px", sm: "14px", md: "16px", lg: "18px", xl: "20px", "2xl": "24px" },
    weight: { regular: "400", medium: "500", semibold: "600", bold: "700" },
    leading: { tight: "1.25", normal: "1.5", relaxed: "1.7" },
  },

  radius: { xs: "6px", sm: "8px", md: "10px", lg: "12px", xl: "16px" },

  shadow: {
    sm: "0 1px 2px rgba(0,0,0,0.5)",
    md: "0 8px 18px -16px rgba(0,0,0,0.6)",
    lg: "-10px 0 24px rgba(0,0,0,.6)",
  },

  z: { header: "50", overlay: "1000", modal: "1100" },

  space: { xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "24px", xxl: "32px" },

  motion: {
    fast: "80ms",
    normal: "150ms",
    slow: "250ms",
    easing: { standard: "cubic-bezier(.2,0,.2,1)", emphasized: "cubic-bezier(.2,0,0,1)" },
  },

  layout: { max: { md: "1200px", lg: "1320px", xl: "1440px" } },
});

// ==============================
// Alias-uri & tipuri utile — strict, fără `any`
// ==============================
export const themeClasses = {
  light: themeClassLight,
  dark: themeClassDark,
} as const;

export type ThemeVars = typeof vars;
export type ThemeMode = keyof typeof themeClasses;

// ==============================
// Breakpoints (const, tipate)
// ==============================
export const mq = {
  md: "screen and (min-width: 768px)",
  lg: "screen and (min-width: 900px)",
  xl: "screen and (min-width: 1200px)",
} as const;
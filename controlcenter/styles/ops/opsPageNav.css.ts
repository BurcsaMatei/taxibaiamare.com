// controlcenter/styles/ops/opsPageNav.css.ts

// ==============================
// Imports
// ==============================
import { vars } from "@taxi/tokens";
import { style } from "@vanilla-extract/css";

// ==============================
// Styles
// ==============================
export const nav = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space.sm,
});

export const navLink = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 40,
  paddingInline: vars.space.lg,
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
  color: vars.color.text,
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap",
  boxShadow: vars.shadow.md,
  transition: `transform ${vars.motion.fast} ${vars.motion.easing.standard}, background-color ${vars.motion.fast} ${vars.motion.easing.standard}`,
  selectors: {
    "&:hover": { transform: "translateY(-1px)", background: vars.color.surfaceHover },
    "&:active": { transform: "translateY(0px)" },
    "&:focus-visible": { outline: `2px solid ${vars.color.focus}`, outlineOffset: 2 },
  },
});

export const navLinkActive = style({
  background: vars.color.primary,
  color: vars.color.bg,
  borderColor: vars.color.primary,
  selectors: {
    "&:hover": { transform: "none", background: vars.color.primary },
  },
});

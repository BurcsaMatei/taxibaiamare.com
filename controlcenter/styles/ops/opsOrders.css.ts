// controlcenter/styles/ops/opsOrders.css.ts

// ==============================
// Imports
// ==============================
import { vars } from "@taxi/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

// ==============================
// Styles
// ==============================
export const tableWrap = style({
  overflow: "auto",
  borderRadius: vars.radius.lg,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
});

// ✅ full-bleed wrapper for Orders (no container feel)
export const tableWrapFullBleed = style({
  overflow: "auto",
  borderRadius: vars.radius.lg,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
  boxShadow: vars.shadow.md,
});

export const table = style({
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  fontSize: "14px",
});

export const thead = style({
  position: "sticky",
  top: 0,
  background: vars.color.surface,
  zIndex: 2,
});

// ✅ separatoare verticale între coloane (nu și după ultima), ca tabelul să se poată citi mai ușor
export const th = style({
  textAlign: "left",
  padding: vars.space.md,
  borderBottom: `1px solid ${vars.color.border}`,
  borderRight: `1px solid ${vars.color.border}`,
  color: vars.color.muted,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  selectors: {
    "&:last-child": { borderRight: "none" },
  },
});

export const td = style({
  padding: vars.space.md,
  borderBottom: `1px solid ${vars.color.border}`,
  borderRight: `1px solid ${vars.color.border}`,
  verticalAlign: "top",
  fontWeight: 700,
  selectors: {
    "&:last-child": { borderRight: "none" },
  },
});

// ✅ VE: nu putem face "&:hover td" în selectors; folosim globalStyle
// (backgroundColor, nu `background`: shorthand-ul ar șterge nuanța rândului, care e un background-image)
export const trHover = style({});

globalStyle(`${trHover}:hover ${td}`, {
  backgroundColor: vars.color.surfaceHover,
});

// ✅ rânduri colorate: verde = alocată/în cursă/finalizată, roșu = fără mașină liberă
export const rowOk = style({});
export const rowFailed = style({});

globalStyle(`${rowOk} ${td}`, {
  backgroundImage: `linear-gradient(${vars.color.tintOk}, ${vars.color.tintOk})`,
});

globalStyle(`${rowFailed} ${td}`, {
  backgroundImage: `linear-gradient(${vars.color.tintFailed}, ${vars.color.tintFailed})`,
});

export const cellMono = style({
  fontFamily: vars.typography.font.mono,
  fontSize: "12px",
  fontWeight: 800,
});

export const badge = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space.sm,
  paddingInline: vars.space.md,
  paddingBlock: "6px",
  borderRadius: 999,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surfaceHover,
  fontWeight: 900,
  whiteSpace: "nowrap",
});

export const badgeMuted = style({
  color: vars.color.muted,
});

export const empty = style({
  padding: vars.space.lg,
  color: vars.color.muted,
  fontWeight: 900,
});

export const rowSplit = style({
  display: "grid",
  gap: 6,
});

export const small = style({
  fontSize: "12px",
  color: vars.color.muted,
  fontWeight: 800,
});

// ==============================
// Căutare (perioadă + indicativ) și mesaje
// ==============================
export const toolbar = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: vars.space.md,
  marginBottom: vars.space.lg,
  padding: vars.space.lg,
  borderRadius: vars.radius.lg,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
  boxShadow: vars.shadow.md,
});

export const field = style({
  display: "grid",
  gap: vars.space.xs,
});

export const fieldLabel = style({
  fontSize: "12px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  color: vars.color.muted,
});

export const input = style({
  height: 40,
  paddingInline: vars.space.md,
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.bg,
  color: vars.color.text,
  fontWeight: 700,
  fontFamily: "inherit",
  selectors: {
    "&:focus-visible": { outline: `2px solid ${vars.color.focus}`, outlineOffset: 2 },
  },
});

export const button = style({
  height: 40,
  paddingInline: vars.space.lg,
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
  color: vars.color.text,
  fontWeight: 900,
  fontFamily: "inherit",
  whiteSpace: "nowrap",
  cursor: "pointer",
  selectors: {
    "&:hover:not(:disabled)": { background: vars.color.surfaceHover },
    "&:focus-visible": { outline: `2px solid ${vars.color.focus}`, outlineOffset: 2 },
    "&:disabled": { opacity: 0.6, cursor: "not-allowed" },
  },
});

export const buttonPrimary = style({
  background: vars.color.primary,
  color: vars.color.bg,
  borderColor: vars.color.primary,
  selectors: {
    "&:hover:not(:disabled)": { background: vars.color.primary },
  },
});

export const notice = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: vars.space.md,
  marginBottom: vars.space.lg,
  padding: vars.space.md,
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surfaceHover,
  fontWeight: 800,
});

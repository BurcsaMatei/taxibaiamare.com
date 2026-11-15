// controlcenter/styles/ops/opsHudTop.css.ts

// ==============================
// Imports
// ==============================
import { vars } from "@taxi/tokens";
import { style } from "@vanilla-extract/css";

// ==============================
// Styles
// ==============================
// Pagina nu derulează: sus stă blocul fix (antet + căutare), dedesubt zona tabelului, care derulează singură.
export const page = style({
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
  height: "100vh",
  overflow: "hidden",
  background: vars.color.bg,
  color: vars.color.text,
  "@supports": {
    "(height: 100dvh)": { height: "100dvh" },
  },
});

// blocul fix de sus (antetul + rândul de căutare); deasupra tabelului, ca să nu fie acoperit de meniurile din antet
export const headStack = style({
  position: "relative",
  zIndex: vars.z.header,
});

export const topHud = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space.lg,
  paddingInline: vars.space.xl,
  paddingBlock: vars.space.lg,
  borderBottom: `1px solid ${vars.color.border}`,
  background: `color-mix(in srgb, ${vars.color.surface} 92%, transparent)`,
  backdropFilter: "blur(10px)",
  flexWrap: "wrap",
});

export const brand = style({
  display: "grid",
  gap: 4,
});

export const brandTitle = style({
  fontWeight: 900,
  letterSpacing: "-0.01em",
  fontSize: 16,
});

export const pageTitle = style({
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: vars.color.muted,
});

export const right = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.lg,
  flexWrap: "wrap",
});

export const pills = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  flexWrap: "wrap",
});

export const pill = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space.sm,
  paddingInline: 10,
  paddingBlock: 6,
  borderRadius: 999,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
  fontWeight: 900,
  fontSize: 12,
  whiteSpace: "nowrap",
});

export const pillMuted = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space.sm,
  paddingInline: 10,
  paddingBlock: 6,
  borderRadius: 999,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
  fontWeight: 900,
  fontSize: 12,
  whiteSpace: "nowrap",
  color: vars.color.muted,
});

// pastilele tehnice se ascund pe ecrane sub 1500px, ca blocul fix de sus să nu ocupe o treime din înălțime
export const hideNarrow = style({
  "@media": {
    "screen and (max-width: 1500px)": { display: "none" },
  },
});

export const mono = style({
  fontFamily: vars.typography.font.mono,
});

export const dot = style({
  width: 10,
  height: 10,
  borderRadius: 999,
  background: vars.color.muted,
});

export const dotOn = style({
  background: vars.color.primary,
});

// containerul care derulează (vertical și orizontal); antetul coloanelor e `sticky` în el, deci rămâne lipit de bara de sus
export const tableArea = style({
  width: "100%",
  minHeight: 0,
  overflow: "auto",
});

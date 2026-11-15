// controlcenter/styles/ops/opsOrders.css.ts

// ==============================
// Imports
// ==============================
import { vars } from "@taxi/tokens";
import { globalStyle, style, styleVariants } from "@vanilla-extract/css";

// ==============================
// Styles
// ==============================
export const tableWrap = style({
  overflow: "auto",
  borderRadius: vars.radius.lg,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
});

// ✅ full-bleed: tabelul ocupă toată lățimea, lipit de bara de sus. Derularea (pe verticală și orizontală)
// o face containerul `tableArea` din opsHudTop.css.ts, deci antetul coloanelor rămâne lipit de bara fixă.
export const tableWrapFullBleed = style({
  background: vars.color.surface,
  minHeight: "100%",
});

// ✅ coloane cu lățime fixă: nu se mai mută când se schimbă conținutul rândurilor (ex. „Fără mașină liberă")
// și antetul se potrivește exact cu celulele. Suma lățimilor = lățimea minimă a tabelului.
const COLUMN_WIDTHS = {
  date: 125, // include marginea mai mare din stânga (prima coloană)
  time: 90,
  pickup: 165,
  dropoff: 165,
  indicativ: 110,
  vehicle: 110,
  dispatch: 200,
  call: 220,
  order: 295,
  status: 150,
  updated: 185, // include marginea mai mare din dreapta (ultima coloană)
} as const;

const TABLE_MIN_WIDTH = Object.values(COLUMN_WIDTHS).reduce((sum, w) => sum + w, 0);

export const colWidth = styleVariants(COLUMN_WIDTHS, (w) => ({ width: w }));

export const table = style({
  width: "100%",
  minWidth: TABLE_MIN_WIDTH,
  tableLayout: "fixed",
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
  height: 44,
  paddingInline: vars.space.md,
  background: vars.color.surface,
  borderBottom: `1px solid ${vars.color.border}`,
  borderRight: `1px solid ${vars.color.border}`,
  color: vars.color.muted,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  selectors: {
    // prima și ultima coloană au aceeași margine ca blocul de sus (vars.space.xl), ca marginile să fie aliniate
    "&:first-child": { paddingInlineStart: vars.space.xl },
    "&:last-child": { borderRight: "none", paddingInlineEnd: vars.space.xl },
  },
});

// ✅ conținut centrat vertical: textul și insignele stau pe aceeași linie, iar rândurile au înălțime uniformă
export const td = style({
  height: 56,
  paddingInline: vars.space.md,
  paddingBlock: vars.space.sm,
  borderBottom: `1px solid ${vars.color.border}`,
  borderRight: `1px solid ${vars.color.border}`,
  verticalAlign: "middle",
  overflowWrap: "anywhere",
  fontWeight: 700,
  selectors: {
    "&:first-child": { paddingInlineStart: vars.space.xl },
    "&:last-child": { borderRight: "none", paddingInlineEnd: vars.space.xl },
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
// ✅ rândul de căutare face parte din blocul fix de sus (sub antet): formularul în stânga, mesajele în dreapta
export const searchRow = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: vars.space.md,
  paddingInline: vars.space.xl,
  paddingBlock: vars.space.sm,
  borderTop: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
});

export const toolbar = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: vars.space.md,
});

export const statusLine = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: vars.space.sm,
  marginInlineStart: "auto",
});

// etichetă și câmp pe același rând: rândul de căutare rămâne scund
export const field = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
});

export const fieldLabel = style({
  fontSize: "12px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  color: vars.color.muted,
});

export const input = style({
  height: 36,
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
  height: 36,
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

// mesaj compact (rezultate căutare, erori) în rândul de căutare
export const notice = style({
  display: "inline-flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: vars.space.sm,
  paddingInline: vars.space.md,
  paddingBlock: vars.space.xs,
  borderRadius: 999,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surfaceHover,
  fontSize: "13px",
  fontWeight: 800,
});

// lib/config.ts

// ==============================
// Dev utils
// ==============================
function isDev(): boolean {
  return typeof process !== "undefined" && process.env?.NODE_ENV !== "production";
}

function devWarn(msg: string, ...args: unknown[]): void {
  if (isDev()) {
    // no-console
    console.warn(`[config.ts] ${msg}`, ...args);
  }
}

// ==============================
// Warn-once (no spam in build logs)
// ==============================
let didWarnMissingSiteUrl = false;

function warnMissingSiteUrlOnce(): void {
  if (didWarnMissingSiteUrl) return;
  didWarnMissingSiteUrl = true;
  // intenționat: fără warning în production (ca să dispară complet)
  devWarn("NEXT_PUBLIC_SITE_URL lipsește. URL-urile absolute vor fi relative.");
}

// ==============================
// Helpers (normalize / urls)
// ==============================
function ensureLeadingSlash(s: string): string {
  if (!s) return "/";
  return s.startsWith("/") ? s : `/${s}`;
}

function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url) || url.startsWith("//");
}

function isSpecialProtocol(url: string): boolean {
  return /^(mailto:|tel:|sms:|data:|javascript:)/i.test(url);
}

function isQueryOrHash(path: string): boolean {
  return path.startsWith("?") || path.startsWith("#");
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = ensureLeadingSlash(path);
  return `${b}${p}`;
}

function normalizeUrl(
  val: string | undefined,
  { requireProtocol = false }: { requireProtocol?: boolean } = {},
): string {
  if (!val) return "";
  const s = val.trim();
  if (!s) return "";

  const hasProtocol = /^https?:\/\//i.test(s) || s.startsWith("//");
  if (requireProtocol && !hasProtocol) {
    devWarn(`URL fără protocol: "${s}". Așteptam http(s)://…`);
    return "";
  }

  if (hasProtocol) return s.replace(/\/+$/, "");
  return s;
}

function normalizeBasePath(val: string | undefined): string {
  const raw = (val || "").trim();
  if (!raw) return "";
  if (!raw.startsWith("/")) {
    devWarn(`BASE_PATH ar trebui să înceapă cu "/". Corectez automat: "/${raw}"`);
  }
  return `/${raw.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function applyBasePath(path: string, basePath: string): string {
  if (isExternal(path)) return path;
  const base = basePath && basePath !== "/" ? basePath : "";
  const normalized = ensureLeadingSlash(path);
  return (base + normalized).replace(/\/\/+/g, "/");
}

function normalizeSiteUrl(input: string): string {
  const v = input.trim().replace(/\/+$/, "");
  if (!v) return "";
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

// ==============================
// Site URL (absolute) — single source of truth
// ==============================
const RAW_ENV_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
const DEV_FALLBACK = "http://localhost:3000";

const SITE_URL_NORMALIZED = normalizeSiteUrl(RAW_ENV_SITE_URL);

// ✅ export public stabil (dev fallback, prod = "" dacă lipsește)
export const SITE_URL =
  SITE_URL_NORMALIZED || (process.env.NODE_ENV !== "production" ? DEV_FALLBACK : "");

// Trailing slash preference (din env brut)
const PREFER_TRAILING = /\/$/.test(RAW_ENV_SITE_URL);

// ==============================
// Site (SEO minimal)
// ==============================
export const SITE = {
  url: SITE_URL,
  name: (process.env.NEXT_PUBLIC_SITE_NAME || "").trim(),
  titleTemplate: (process.env.NEXT_PUBLIC_SITE_TITLE_TEMPLATE || "").trim(),
  defaultTitle: (process.env.NEXT_PUBLIC_DEFAULT_TITLE || "").trim(),
  description: (process.env.NEXT_PUBLIC_SITE_DESC || "").trim(),
  ogImage: (process.env.NEXT_PUBLIC_OG_IMAGE || "").trim(),
  twitterHandle: (process.env.NEXT_PUBLIC_TWITTER_HANDLE || "").trim(),
  locale: (process.env.NEXT_PUBLIC_LOCALE || "").trim(),
} as const;

// ==============================
// Theme (meta theme-color / PWA colors)
// ==============================
const RAW_PWA_LIGHT = (
  process.env.NEXT_PUBLIC_PWA_THEME_COLOR ||
  process.env.NEXT_PUBLIC_THEME_COLOR ||
  ""
).trim();
const RAW_PWA_DARK = (process.env.NEXT_PUBLIC_PWA_THEME_COLOR_DARK || "").trim();
const RAW_UI_LIGHT = (process.env.NEXT_PUBLIC_UI_THEME_COLOR_LIGHT || "").trim();
const RAW_UI_DARK = (process.env.NEXT_PUBLIC_UI_THEME_COLOR_DARK || "").trim();

const DEFAULTS = {
  pwaLight: "#5561F2",
  pwaDark: "#7b84ff",
  uiLight: "#ffffff",
  uiDark: "#0b0b0d",
};

export const THEME = {
  // Manifest (accent) — păstrăm aliasul pentru compat
  pwaThemeColor: RAW_PWA_LIGHT || DEFAULTS.pwaLight,
  pwaThemeColorLight: RAW_PWA_LIGHT || DEFAULTS.pwaLight,
  pwaThemeColorDark: RAW_PWA_DARK || DEFAULTS.pwaDark,

  // Browser UI (meta theme-color)
  uiThemeColorLight: RAW_UI_LIGHT || DEFAULTS.uiLight,
  uiThemeColorDark: RAW_UI_DARK || DEFAULTS.uiDark,
} as const;

// ==============================
// Path / Assets
// ==============================
export const BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

export const ASSET_BASE = normalizeUrl(process.env.NEXT_PUBLIC_ASSET_BASE, {
  requireProtocol: true,
}); // ex: https://cdn.exemplu.com

export function withBase(path: string): string {
  if (!path) return path;
  if (isExternal(path) || isSpecialProtocol(path) || isQueryOrHash(path)) return path;
  return applyBasePath(path, BASE_PATH);
}

// ==============================
// Trailing slash & Canonical
// ==============================
function alignTrailingSlash(pathname: string): string {
  if (!pathname) return "/";
  const ensureLeading = ensureLeadingSlash(pathname);

  if (PREFER_TRAILING) return ensureLeading.endsWith("/") ? ensureLeading : `${ensureLeading}/`;

  if (ensureLeading !== "/" && ensureLeading.endsWith("/")) {
    return ensureLeading.replace(/\/+$/, "");
  }

  return ensureLeading;
}

export function canonical(pathname: string): string {
  if (!SITE.url) {
    warnMissingSiteUrlOnce();
    return pathname;
  }
  if (isExternal(pathname)) return pathname;

  const pathWithBase = withBase(pathname);
  const normalized = alignTrailingSlash(pathWithBase);
  return joinUrl(SITE.url, normalized);
}

// ==============================
// SEO / URL Helpers
// ==============================
export function absoluteUrl(path: string): string {
  if (!path) return path;
  if (!SITE.url) {
    warnMissingSiteUrlOnce();
    return path;
  }
  if (isExternal(path)) return path;

  const idxQ = path.indexOf("?");
  const idxH = path.indexOf("#");
  const cut =
    idxQ === -1 && idxH === -1
      ? -1
      : idxQ === -1
        ? idxH
        : idxH === -1
          ? idxQ
          : Math.min(idxQ, idxH);

  const main: string = cut === -1 ? path : path.slice(0, cut);
  const suffix: string = cut === -1 ? "" : path.slice(cut);

  const mainWithBase = applyBasePath(main, BASE_PATH);
  return joinUrl(SITE.url, mainWithBase) + suffix;
}

export function assetUrl(path: string): string {
  if (!path) return path;
  if (isExternal(path)) return path;
  if (ASSET_BASE) return joinUrl(ASSET_BASE, ensureLeadingSlash(path));
  return withBase(path);
}

export function absoluteAssetUrl(path: string): string {
  if (!path) return path;
  if (isExternal(path)) return path;
  if (ASSET_BASE) return joinUrl(ASSET_BASE, ensureLeadingSlash(path));
  return absoluteUrl(path);
}

export function absoluteOgImage(src?: string): string {
  const img = (src && src.trim()) || SITE.ogImage;
  if (!img) return "";
  return absoluteAssetUrl(img);
}

export const SEO_DEFAULTS = {
  siteName: SITE.name,
  titleTemplate: SITE.titleTemplate,
  defaultTitle: SITE.defaultTitle,
  description: SITE.description,
  ogImage: SITE.ogImage,
  twitterHandle: SITE.twitterHandle,
} as const;

// ==============================
// Compat exporturi
// ==============================
export const seoDefaults = SEO_DEFAULTS;

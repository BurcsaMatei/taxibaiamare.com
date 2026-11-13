// middleware.ts

// ==============================
// Imports
// ==============================
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ==============================
// Utilities
// ==============================
/** Nonce base64url din Web Crypto (Edge-runtime safe) */
function makeNonce(len = 16): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const n of bytes) bin += String.fromCharCode(n);
  // base64url (fără + / =)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

// ==============================
// Middleware
// ==============================
export function middleware(req: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";

  // Feature flags (doar dacă folosești aceste servicii)
  const HAS_GTM = !!(process.env.NEXT_PUBLIC_GTM_ID || "").trim();
  const HAS_GA = !!(process.env.NEXT_PUBLIC_GA4_ID || process.env.NEXT_PUBLIC_GA_ID || "").trim();
  const HAS_FB = !!(process.env.NEXT_PUBLIC_FB_PIXEL_ID || "").trim();
  const HAS_MAPBOX = !!(process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "").trim();

  // Opțional: CDN de imagini din NEXT_PUBLIC_ASSET_BASE
  let ASSET_ORIGIN = "";
  const cdn = (process.env.NEXT_PUBLIC_ASSET_BASE || "").trim();
  if (cdn) {
    try {
      ASSET_ORIGIN = new URL(cdn).origin;
    } catch {
      /* ignore */
    }
  }

  // Origin-ul WebSocket al API-ului (ex: wss://api.taxibaiamare.com) — altfel CSP-ul îl blochează în PROD
  let WS_ORIGIN = "";
  const wsEnv = (process.env.NEXT_PUBLIC_TAXI_WS_URL || "").trim();
  if (wsEnv) {
    try {
      WS_ORIGIN = new URL(wsEnv).origin;
    } catch {
      /* ignore */
    }
  }

  const nonce = makeNonce();

  // ---------------------------------------------------
  // CSP minimală & pragmatică (fără strict-dynamic)
  // ---------------------------------------------------
  const scriptSrc: string[] = [
    "'self'",
    "'unsafe-inline'", // bootstrap temă + JSON-LD (avem și nonce, dar rămânem pragmatici)
    ...(isProd ? [] : ["'unsafe-eval'"]), // Webpack/HMR în DEV
    ...(HAS_GTM ? ["https://www.googletagmanager.com"] : []),
    ...(HAS_GA ? ["https://www.google-analytics.com"] : []),
    ...(HAS_FB ? ["https://connect.facebook.net"] : []),
  ];

  const styleSrc: string[] = [
    "'self'",
    "'unsafe-inline'", // CSS-in-JS & mici inline-uri
    ...(HAS_MAPBOX ? ["https://api.mapbox.com"] : []), // mapbox css (safe allow)
  ];

  const imgSrc: string[] = [
    "'self'",
    "https:",
    "data:",
    "blob:",
    ...(ASSET_ORIGIN ? [ASSET_ORIGIN] : []),
  ];

  const fontSrc: string[] = ["'self'", "https:", "data:"];

  const connectSrc: string[] = [
    "'self'",
    ...(isProd ? [] : ["ws:"]),
    ...(WS_ORIGIN ? [WS_ORIGIN] : []),
    ...(HAS_GA ? ["https://www.google-analytics.com", "https://region1.google-analytics.com"] : []),
    ...(HAS_GTM ? ["https://www.googletagmanager.com"] : []),
    ...(HAS_FB ? ["https://graph.facebook.com", "https://connect.facebook.net"] : []),

    // Mapbox: styles, tiles, glyphs, telemetry
    ...(HAS_MAPBOX
      ? ["https://api.mapbox.com", "https://events.mapbox.com", "https://*.mapbox.com"]
      : []),
  ];

  const frameSrc: string[] = ["'self'", "https://www.google.com", "https://*.google.com"];

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(" ")}`,
    `style-src ${styleSrc.join(" ")}`,
    `img-src ${imgSrc.join(" ")}`,
    `font-src ${fontSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
    `frame-src ${frameSrc.join(" ")}`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'self'`,
  ];

  const csp = directives.join("; ");

  // Propagăm nonce-ul către server (citit în _document/JsonLd)
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-csp-nonce", nonce);

  // Răspunsul către client + headerul CSP (Report-Only în DEV, enforce în PROD)
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  if (isProd) {
    res.headers.set("Content-Security-Policy", csp);
  } else {
    res.headers.set("Content-Security-Policy-Report-Only", csp);
  }
  // Optional: expunem nonce și pe răspuns (util debug / alte componente client-only)
  res.headers.set("x-csp-nonce", nonce);

  return res;
}

// ==============================
// Config
// ==============================
export const config = {
  matcher: ["/:path*"],
};

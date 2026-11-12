// controlcenter/lib/auth/controlcenterAuth.ts

// ==============================
// Imports
// ==============================
import type { ControlcenterScope, ControlcenterTokenPayload } from "@taxi/shared";

// ==============================
// Types
// ==============================
export type ControlcenterLoginOk = {
  ok: true;
  token: string;
  scope: ControlcenterScope;
  cityId: string;
  exp: number;
};

export type ControlcenterLoginErr = {
  ok: false;
  error: string;
};

type ControlcenterLoginResponse = ControlcenterLoginOk | ControlcenterLoginErr;

// ==============================
// Constante
// ==============================
const STORAGE_KEY = "taxi_cc_token";

/** Orașul în care intră direct operatorul după login (singurul cu flotă). */
export const DEFAULT_CITY_ID = "baia-mare";

// ==============================
// Utils
// ==============================
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function base64UrlToUtf8(b64url: string): string {
  const pad = b64url.length % 4 === 0 ? "" : "=".repeat(4 - (b64url.length % 4));
  const b64 = b64url.replaceAll("-", "+").replaceAll("_", "/") + pad;

  const bin = window.atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);

  return new TextDecoder().decode(bytes);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function parsePayload(raw: unknown): ControlcenterTokenPayload | null {
  if (!isObject(raw)) return null;

  if (raw.v !== 1) return null;
  if (raw.sub !== "controlcenter") return null;
  if (raw.scope !== "hq" && raw.scope !== "city") return null;

  const iat = raw.iat;
  const exp = raw.exp;
  if (typeof iat !== "number" || !Number.isFinite(iat)) return null;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return null;

  if (raw.scope === "city") {
    const cityId = raw.cityId;
    if (typeof cityId !== "string" || cityId.trim().length === 0) return null;

    return {
      v: 1,
      sub: "controlcenter",
      scope: "city",
      cityId: cityId.trim().toLowerCase(),
      iat,
      exp,
    };
  }

  return { v: 1, sub: "controlcenter", scope: "hq", iat, exp };
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function parseLoginResponse(raw: unknown): ControlcenterLoginResponse | null {
  if (!isObject(raw)) return null;

  const ok = raw.ok;
  if (ok === true) {
    const token = raw.token;
    const scope = raw.scope;
    const cityId = raw.cityId;
    const exp = raw.exp;

    if (typeof token !== "string" || token.trim().length === 0) return null;
    if (scope !== "hq" && scope !== "city") return null;
    if (typeof cityId !== "string" || cityId.trim().length === 0) return null;
    if (typeof exp !== "number" || !Number.isFinite(exp)) return null;

    return {
      ok: true,
      token: token.trim(),
      scope,
      cityId: cityId.trim().toLowerCase(),
      exp,
    };
  }

  if (ok === false) {
    const error = raw.error;
    if (typeof error !== "string" || error.trim().length === 0)
      return { ok: false, error: "Login failed" };
    return { ok: false, error: error.trim() };
  }

  return null;
}

// ==============================
// Storage
// ==============================
export function getStoredControlcenterToken(): string | null {
  if (!isBrowser()) return null;
  const t = window.localStorage.getItem(STORAGE_KEY);
  return typeof t === "string" && t.trim().length > 0 ? t.trim() : null;
}

export function setStoredControlcenterToken(token: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearStoredControlcenterToken(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function decodeControlcenterTokenPayloadUnsafe(
  token: string,
): ControlcenterTokenPayload | null {
  if (!isBrowser()) return null;

  const trimmed = token.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(".");
  if (parts.length !== 2) return null;

  const payloadB64 = parts[0] ?? "";
  if (!payloadB64) return null;

  try {
    const json = base64UrlToUtf8(payloadB64);
    const raw = JSON.parse(json) as unknown;
    return parsePayload(raw);
  } catch {
    return null;
  }
}

export function isControlcenterTokenExpired(payload: ControlcenterTokenPayload): boolean {
  return payload.exp <= nowSec();
}

// ==============================
// Login
// ==============================
export async function loginControlcenter(password: string): Promise<ControlcenterLoginOk> {
  const res = await fetch("/api/auth/controlcenter/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });

  const data = (await res.json()) as unknown;

  const parsed = parseLoginResponse(data);
  if (!parsed) {
    throw new Error("Invalid login response");
  }

  if (!parsed.ok) {
    throw new Error(parsed.error || "Login failed");
  }

  // optional: if server returned non-2xx with ok:true (shouldn’t), still accept token
  return parsed;
}

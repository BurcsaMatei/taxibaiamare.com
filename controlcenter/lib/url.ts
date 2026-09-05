// lib/url.ts

// ==============================
// Imports
// ==============================
import type { IncomingMessage } from "http";
import type { Socket } from "net";
import type { TLSSocket } from "tls";

import { BASE_PATH, withBase } from "./config";

// ==============================
// Utils interne
// ==============================
function isDev(): boolean {
  return typeof process !== "undefined" && process.env?.NODE_ENV !== "production";
}
function devWarn(msg: string, ...args: unknown[]) {
  if (isDev()) {
    // no-console
    console.warn(`[url.ts] ${msg}`, ...args);
  }
}

/** Returnează primul element dintr-un header posibil multi-valoare. */
export function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Pentru header-ele CSV (ex: "https,http") returnează prima valoare, trimuită. */
function firstCsvHeader(value: string | string[] | undefined): string | undefined {
  const v = firstHeader(value);
  return v ? v.split(",")[0]?.trim() : undefined;
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url) || url.startsWith("//");
}

function isQueryOrHash(path: string): boolean {
  return path.startsWith("?") || path.startsWith("#");
}

// ==============================
// Forwarded header (RFC 7239) parsing
// ==============================
type Forwarded = { proto?: string; host?: string };

function parseForwardedHeader(value: string | string[] | undefined): Forwarded | null {
  const raw = firstHeader(value);
  if (!raw) return null;
  // Luăm primul "entry" din listă (în caz că sunt mai multe, separate prin ',')
  const first = raw.split(",")[0]!.trim();
  const parts = first
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);

  const out: Forwarded = {};
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    let val = part.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    if (key === "proto") out.proto = val;
    else if (key === "host") out.host = val;
  }
  return out;
}

function parseCfVisitor(value: string | string[] | undefined): string | undefined {
  const raw = firstHeader(value);
  if (!raw) return undefined;
  try {
    const obj = JSON.parse(raw) as { scheme?: string };
    return obj.scheme;
  } catch {
    return undefined;
  }
}

function isDefaultPort(proto: string, port?: string): boolean {
  if (!port) return true;
  const p = String(port);
  return (proto === "https" && p === "443") || (proto === "http" && p === "80");
}

function appendPortIfNeeded(host: string, proto: string, xfpPort?: string): string {
  if (!xfpPort) return host;
  if (host.includes(":")) return host; // deja are port
  if (isDefaultPort(proto, xfpPort)) return host;
  return `${host}:${xfpPort}`;
}

// Type guard: detectează TLSSocket fără `any`
function isTLSSocket(s: Socket): s is TLSSocket {
  return typeof (s as TLSSocket).encrypted === "boolean";
}

// ==============================
// API public
// ==============================

/**
 * Determină URL-ul de bază (scheme + host[:port]).
 * 1) Preferă NEXT_PUBLIC_SITE_URL (fără trailing slash).
 * 2) Altfel, folosește RFC 7239 Forwarded, apoi X-Forwarded-*, cf-visitor, :scheme, socket.encrypted.
 */
export function getRequestBaseUrl(req: IncomingMessage): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  const headers = (req.headers ?? {}) as Record<string, string | string[] | undefined>;

  // 1) RFC 7239: Forwarded: for=...;proto=https;host=example.com:8443
  const fwd = parseForwardedHeader(headers["forwarded"]);

  // 2) X-Forwarded-* (standard de facto)
  const xProto = firstCsvHeader(headers["x-forwarded-proto"]);
  const xHost = firstCsvHeader(headers["x-forwarded-host"]);
  const xPort = firstCsvHeader(headers["x-forwarded-port"]);
  const xSsl = firstCsvHeader(headers["x-forwarded-ssl"]); // "on" -> https

  // 3) HTTP/2 pseudo-header (rare în Node extern): :scheme
  const h2Scheme = firstHeader(headers[":scheme"]);

  // 4) Cloudflare: cf-visitor: {"scheme":"https"}
  const cfScheme = parseCfVisitor(headers["cf-visitor"]);

  // 5) Socket (TLS)
  const socket = req.socket as Socket;
  const isTls = isTLSSocket(socket) ? socket.encrypted === true : false;

  // Proto precedence
  const proto =
    fwd?.proto ||
    xProto ||
    (xSsl && /^(on|1|true)$/i.test(xSsl) ? "https" : undefined) ||
    cfScheme ||
    h2Scheme ||
    (isTls ? "https" : "http");

  // Host precedence
  let host = fwd?.host || xHost || firstHeader(headers["host"]) || "localhost:3000";
  // Dacă nu are port și există X-Forwarded-Port pe un port non-standard, atașăm
  host = appendPortIfNeeded(host, proto, xPort);

  return stripTrailingSlash(`${proto}://${host}`);
}

/**
 * Aplică BASE_PATH pe rutele interne și le lipește de un host absolut.
 * - Dacă `path` este absolut (http/https) → îl întoarce neschimbat.
 * - Dacă `path` începe cu ? sau # → atașează la rădăcina host-ului.
 */
export function joinHostPath(host: string, path: string): string {
  if (!host) {
    if (isDev()) devWarn("joinHostPath: host gol.");
    return path;
  }
  if (!path) return stripTrailingSlash(host);

  if (isExternal(path)) return path;

  const normalizedHost = stripTrailingSlash(host);
  if (isQueryOrHash(path)) {
    // ex: joinHostPath("https://ex.com", "?q=1") -> "https://ex.com/?q=1"
    const base = BASE_PATH && BASE_PATH !== "/" ? BASE_PATH : "";
    return `${normalizedHost}${base || "/"}` + path;
  }

  // Aplicăm BASE_PATH prin withBase (respectă mailto:, tel:, ?/# etc.)
  const withBaseApplied = withBase(path);
  const normalizedPath = withBaseApplied.startsWith("/") ? withBaseApplied : `/${withBaseApplied}`;
  return `${normalizedHost}${normalizedPath}`;
}

/**
 * Construcție absolută pe baza request-ului curent.
 * Echivalent cu: joinHostPath(getRequestBaseUrl(req), path)
 */
export function absoluteFromRequest(req: IncomingMessage, path: string): string {
  const base = getRequestBaseUrl(req);
  return joinHostPath(base, path);
}

// pages/api/csp-report.ts

// ==============================
// Imports
// ==============================
import type { NextApiRequest, NextApiResponse } from "next";

// ==============================
// Types
// ==============================
type LegacyCspEnvelope = {
  "csp-report"?: Record<string, unknown>;
  [k: string]: unknown;
};

type ReportingApiItem = {
  type?: string;
  url?: string;
  body?: Record<string, unknown>;
  [k: string]: unknown;
};

type ReportingApiEnvelope = ReportingApiItem[];

// ==============================
// Config
// ==============================
/**
 * Dezactivăm bodyParser-ul implicit ca să putem procesa
 * `application/csp-report` și `application/reports+json` (raw body).
 * IMPORTANT: fără `as const` — Next nu suportă const assertion aici.
 */
export const config = {
  api: { bodyParser: false },
};

// ==============================
// Utils
// ==============================
async function readRawBody(req: NextApiRequest, maxBytes = 64 * 1024): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let total = 0;
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Payload Too Large"));
        return;
      }
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function s(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** Sumar minimal pentru log în dev (fără PII). */
function toDevSummary(payload: unknown): unknown {
  // Legacy: application/csp-report
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const env = payload as LegacyCspEnvelope;
    const body = env["csp-report"];
    if (body && typeof body === "object") {
      const o = body as Record<string, unknown>;
      return {
        kind: "csp-report",
        "document-uri": s(o["document-uri"]),
        "violated-directive": s(o["violated-directive"]),
        "effective-directive": s(o["effective-directive"]),
        "blocked-uri": s(o["blocked-uri"]),
        disposition: s(o["disposition"]),
        "status-code": o["status-code"] ?? null,
        sample: s(o["script-sample"]),
      };
    }
  }

  // Reporting API: application/reports+json
  if (Array.isArray(payload)) {
    const items = payload as ReportingApiEnvelope;
    return items.map((it) => {
      const b =
        it && it.body && typeof it.body === "object" ? (it.body as Record<string, unknown>) : {};
      return {
        kind: "report-to",
        type: s(it.type),
        url: s(it.url),
        "effective-directive": s(b["effective-directive"]),
        "violated-directive": s(b["violated-directive"]),
        "blocked-uri": s(b["blocked-uri"]),
        disposition: s(b["disposition"]),
        "status-code": b["status-code"] ?? null,
      };
    });
  }

  return null;
}

// ==============================
// Handler
// ==============================
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).end("Method Not Allowed");
    return;
  }

  const lenHeader = req.headers["content-length"];
  const len =
    typeof lenHeader === "string"
      ? Number(lenHeader)
      : Array.isArray(lenHeader)
        ? Number(lenHeader[0])
        : 0;
  if (Number.isFinite(len) && len > 64 * 1024) {
    res.status(413).end("Payload Too Large");
    return;
  }

  let raw = "";
  try {
    raw = await readRawBody(req, 64 * 1024);
  } catch {
    res.status(413).end("Payload Too Large");
    return;
  }

  const ct = String(req.headers["content-type"] || "").toLowerCase();

  let payload: unknown = null;
  try {
    if (
      ct.includes("application/csp-report") ||
      ct.includes("application/reports+json") ||
      ct.includes("application/json") ||
      ct.includes("text/plain")
    ) {
      payload = raw ? (JSON.parse(raw) as unknown) : null;
    }
  } catch {
    res.status(400).end("Invalid JSON");
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    // no-console
    console.warn("[CSP-Report]", JSON.stringify(toDevSummary(payload)));
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(204).end();
}

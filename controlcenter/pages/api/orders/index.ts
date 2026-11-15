// controlcenter/pages/api/orders/index.ts

// ==============================
// Imports
// ==============================
import type { NextApiRequest, NextApiResponse } from "next";

// ==============================
// Types
// ==============================
type OrdersErr = { ok: false; error: string };

// ==============================
// Utils
// ==============================
function readEnv(name: string): string | null {
  const v = process.env[name];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function apiBaseUrl(): string {
  return readEnv("TAXI_API_BASE_URL") ?? "http://localhost:3001";
}

// Query string-ul se trimite exact cum a venit (API-ul îl validează: cityId, status, vehicleId, from, to, limit).
function rawSearch(req: NextApiRequest): string {
  const url = typeof req.url === "string" ? req.url : "";
  const i = url.indexOf("?");
  return i === -1 ? "" : url.slice(i);
}

// ==============================
// Handler
// ==============================
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<unknown | OrdersErr>,
): Promise<void> {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const auth = typeof req.headers.authorization === "string" ? req.headers.authorization : "";

    const r = await fetch(`${apiBaseUrl()}/orders${rawSearch(req)}`, {
      method: "GET",
      headers: auth ? { authorization: auth } : {},
    });

    const text = await r.text();

    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      res.status(502).json({ ok: false, error: "Invalid upstream response" });
      return;
    }

    res.status(r.status).json(data);
  } catch {
    res.status(502).json({ ok: false, error: "Orders proxy error" });
  }
}

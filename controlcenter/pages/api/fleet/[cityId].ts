// controlcenter/pages/api/fleet/[cityId].ts

// ==============================
// Imports
// ==============================
import type { NextApiRequest, NextApiResponse } from "next";

// ==============================
// Types
// ==============================
type FleetVehicle = {
  vehicleId: string;
  indicativLabel: string;
  plateNumber: string;
  driverName: string;
  carModel: string;
  carImagePath: string;
  driverImagePath: string;
};

type FleetResponseOk = {
  ok: true;
  cityId: string;
  total: number;
  vehicles: ReadonlyArray<FleetVehicle>;
};

type FleetResponseErr = {
  ok: false;
  error: string;
};

type FleetResponse = FleetResponseOk | FleetResponseErr;

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

function getCityId(req: NextApiRequest): string | null {
  const raw = req.query.cityId;
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  return null;
}

// ==============================
// Handler
// ==============================
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FleetResponse>,
): Promise<void> {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const cityId = getCityId(req);
  if (!cityId) {
    res.status(400).json({ ok: false, error: "Missing cityId" });
    return;
  }

  const base = apiBaseUrl();
  const url = `${base}/dev/fleet/${encodeURIComponent(cityId)}`;

  try {
    const auth = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
    const r = await fetch(url, {
      method: "GET",
      headers: auth ? { authorization: auth } : {},
    });

    if (!r.ok) {
      res.status(502).json({ ok: false, error: `Upstream error: ${r.status}` });
      return;
    }

    const data = (await r.json()) as unknown;

    if (!data || typeof data !== "object") {
      res.status(502).json({ ok: false, error: "Invalid upstream response" });
      return;
    }

    const d = data as Partial<FleetResponseOk>;
    if (
      !d.ok ||
      !Array.isArray(d.vehicles) ||
      typeof d.cityId !== "string" ||
      typeof d.total !== "number"
    ) {
      res.status(502).json({ ok: false, error: "Upstream returned unexpected shape" });
      return;
    }

    res.status(200).json(d as FleetResponseOk);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Fetch failed";
    res.status(502).json({ ok: false, error: msg });
  }
}

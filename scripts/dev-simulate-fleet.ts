// scripts/dev-simulate-fleet.ts
//
// Simulator de flotă pentru dev: ia vehicule reale din GET /dev/fleet/:cityId și trimite
// PATCH /dev/vehicles/:id/location pe o traiectorie circulară cu wobble (port al vechiului
// dev-simulate-fleet.ps1). La Ctrl+C trimite PATCH /dev/vehicles/:id/offline (best-effort).
//
// Rulare: PASSWORD='parola' npm run sim:fleet -- --city baia-mare --count 20 --interval 800
// (API-ul cere token pe aceste rute: simulatorul se loghează cu PASSWORD, parola controlcenter-ului.
//  Alternativ: TAXI_API_TOKEN cu un token deja emis.)

// ==============================
// Types
// ==============================
type GeoCenter = { lat: number; lng: number };

type CliOptions = {
  city: string;
  count: number;
  intervalMs: number;
  baseUrl: string;
};

type SimVehicle = {
  vehicleId: string;
  phase: number;
};

// ==============================
// Constante
// ==============================
// Centre per oraș — copiate din api/src/modules/cities/index.ts (mapCenter).
const CITY_CENTERS: Readonly<Record<string, GeoCenter>> = {
  "baia-mare": { lat: 47.659, lng: 23.584 },
  "cluj-napoca": { lat: 46.7712, lng: 23.6236 },
  "satu-mare": { lat: 47.792, lng: 22.885 },
  timisoara: { lat: 45.7489, lng: 21.2287 },
  iasi: { lat: 47.1585, lng: 27.5889 },
};

const RADIUS_LAT = 0.0012;
const RADIUS_LNG = 0.0018;
const WOBBLE = 0.00015;

const DEFAULTS: CliOptions = {
  city: "baia-mare",
  count: 10,
  intervalMs: 800,
  baseUrl: "http://localhost:3001",
};

// ==============================
// Utils
// ==============================
function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function normalizePositiveInt(raw: string | undefined, fallback: number): number {
  if (typeof raw !== "string") return fallback;
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

function parseArgs(argv: ReadonlyArray<string>): CliOptions {
  const out: CliOptions = { ...DEFAULTS };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];

    if (flag === "--city" && typeof value === "string" && value.trim()) {
      out.city = value.trim();
      i += 1;
    } else if (flag === "--count") {
      out.count = normalizePositiveInt(value, DEFAULTS.count);
      i += 1;
    } else if (flag === "--interval") {
      out.intervalMs = normalizePositiveInt(value, DEFAULTS.intervalMs);
      i += 1;
    } else if (flag === "--base-url" && typeof value === "string" && value.trim()) {
      out.baseUrl = value.trim().replace(/\/+$/, "");
      i += 1;
    }
  }

  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==============================
// Auth
// ==============================
let authHeaders: Record<string, string> = {};

async function authenticate(baseUrl: string): Promise<boolean> {
  const preset = (process.env.TAXI_API_TOKEN ?? "").trim();
  if (preset) {
    authHeaders = { authorization: `Bearer ${preset}` };
    return true;
  }

  const password = process.env.PASSWORD ?? "";
  if (!password) return false;

  try {
    const res = await fetch(`${baseUrl}/auth/controlcenter/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data: unknown = await res.json();
    if (!isObject(data) || data.ok !== true || typeof data.token !== "string") return false;
    authHeaders = { authorization: `Bearer ${data.token}` };
    return true;
  } catch {
    return false;
  }
}

// ==============================
// API client
// ==============================
async function fetchFleetVehicleIds(baseUrl: string, cityId: string): Promise<string[] | null> {
  let payload: unknown;
  try {
    const res = await fetch(`${baseUrl}/dev/fleet/${encodeURIComponent(cityId)}`, {
      headers: authHeaders,
    });
    payload = await res.json();
  } catch {
    return null;
  }

  if (!isObject(payload) || payload.ok !== true || !Array.isArray(payload.vehicles)) return null;

  const ids: string[] = [];
  for (const v of payload.vehicles) {
    if (!isObject(v)) continue;
    if (typeof v.vehicleId !== "string" || !v.vehicleId.trim()) continue;
    ids.push(v.vehicleId);
  }

  return ids;
}

async function patchLocation(
  opts: CliOptions,
  vehicleId: string,
  lat: number,
  lng: number,
): Promise<boolean> {
  const url = `${opts.baseUrl}/dev/vehicles/${encodeURIComponent(vehicleId)}/location`;
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...authHeaders },
      body: JSON.stringify({ cityId: opts.city, lat, lng }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function patchOffline(opts: CliOptions, vehicleId: string): Promise<void> {
  try {
    await fetch(`${opts.baseUrl}/dev/vehicles/${encodeURIComponent(vehicleId)}/offline`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...authHeaders },
      body: JSON.stringify({ cityId: opts.city }),
    });
  } catch {
    // best-effort: TTL-ul de 60s din API rămâne plasa de siguranță
  }
}

// ==============================
// Main
// ==============================
async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  const center = CITY_CENTERS[opts.city];
  if (!center) {
    console.error(
      `[fleet-sim] Oraș necunoscut: "${opts.city}". Orașe suportate: ${Object.keys(CITY_CENTERS).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  if (!(await authenticate(opts.baseUrl))) {
    console.error(
      "[fleet-sim] Autentificare eșuată. Setează PASSWORD (parola controlcenter) sau TAXI_API_TOKEN.",
    );
    process.exitCode = 1;
    return;
  }

  const allIds = await fetchFleetVehicleIds(opts.baseUrl, opts.city);
  if (allIds === null) {
    console.error(
      `[fleet-sim] Nu pot citi GET ${opts.baseUrl}/dev/fleet/${opts.city} — API-ul rulează?`,
    );
    process.exitCode = 1;
    return;
  }
  if (allIds.length === 0) {
    console.error(
      `[fleet-sim] Orașul "${opts.city}" are 0 vehicule în fleet directory — nimic de simulat. ` +
        `(Doar baia-mare are flotă până la taxi-016.)`,
    );
    process.exitCode = 1;
    return;
  }

  const count = Math.min(opts.count, allIds.length);
  const vehicles: SimVehicle[] = allIds.slice(0, count).map((vehicleId, i) => ({
    vehicleId,
    phase: (2 * Math.PI * i) / Math.max(1, count),
  }));

  console.log(
    `[fleet-sim] city=${opts.city} baseUrl=${opts.baseUrl} vehicles=${count} interval=${opts.intervalMs}ms`,
  );
  console.log("[fleet-sim] Stop: Ctrl+C (trimite offline pentru toate vehiculele)");

  let running = true;
  const stop = (): void => {
    running = false;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  const startedAt = Date.now();

  while (running) {
    const t = (Date.now() - startedAt) / 1000;

    for (const v of vehicles) {
      // traiectorie circulară cu wobble (port 1:1 din dev-simulate-fleet.ps1)
      const ang = t * 0.7 + v.phase;
      const lat = center.lat + RADIUS_LAT * Math.cos(ang) + WOBBLE * Math.sin(ang * 2.0);
      const lng = center.lng + RADIUS_LNG * Math.sin(ang) + WOBBLE * Math.cos(ang * 1.6);

      const ok = await patchLocation(opts, v.vehicleId, lat, lng);
      if (!ok) console.warn(`[fleet-sim] PATCH location eșuat pentru ${v.vehicleId}`);
      if (!running) break;
    }

    if (!running) break;
    await sleep(opts.intervalMs);
  }

  console.log("[fleet-sim] Oprire — trimit offline (best-effort)...");
  await Promise.all(vehicles.map((v) => patchOffline(opts, v.vehicleId)));
  console.log("[fleet-sim] done");
}

void main();

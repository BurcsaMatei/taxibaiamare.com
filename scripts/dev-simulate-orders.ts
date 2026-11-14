// scripts/dev-simulate-orders.ts
//
// Simulator de comenzi pentru dev/demo: creează comenzi de test prin POST /orders, le trece prin
// statusuri (PATCH /orders/:id/status) și trimite apeluri la dispecerat (POST /orders/:id/call).
// Controlcenter-ul doar observă: comenzile apar live pe pagina de comenzi.
//
// Rulare: PASSWORD='parola' npm run sim:orders -- --city baia-mare --interval 5000
// Producție: PASSWORD='parola' npm run sim:orders -- --base-url https://api.taxibaiamare.com
// (Pornește și `npm run sim:fleet`: fără vehicule online, dispecerizarea eșuează.)
//
// Autentificare ca la sim:fleet: PASSWORD (parola controlcenter) sau TAXI_API_TOKEN.
// La Ctrl+C: oprește comenzile noi și anulează comenzile rămase active (best-effort).

// ==============================
// Types
// ==============================
type GeoCenter = { lat: number; lng: number };

type CliOptions = {
  city: string;
  intervalMs: number;
  baseUrl: string;
  forceCalls: boolean;
};

// Subset din OrderStatus (@taxi/shared) folosit de simulator; scriptul rulează cu tsx, fără build.
type SimStatus = "NEW" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";

type CreatedOrder = {
  orderId: string;
  dispatchOk: boolean;
};

// ==============================
// Constante
// ==============================
// Centre per oraș — copiate din api/src/modules/cities/index.ts (mapCenter), ca în sim:fleet.
const CITY_CENTERS: Readonly<Record<string, GeoCenter>> = {
  "baia-mare": { lat: 47.659, lng: 23.584 },
  "cluj-napoca": { lat: 46.7712, lng: 23.6236 },
  "satu-mare": { lat: 47.792, lng: 22.885 },
  timisoara: { lat: 45.7489, lng: 21.2287 },
  iasi: { lat: 47.1585, lng: 27.5889 },
};

// Raza în care se aleg punctele de ridicare/destinație (grade, ~2 km pe lat).
const SPREAD_LAT = 0.018;
const SPREAD_LNG = 0.026;

// Număr clar fals — nu apelează nimic real.
const FAKE_PHONE = "+40700000000";

const CANCEL_CHANCE = 0.15;
const FORCED_CALL_CHANCE = 0.2;

const DEFAULTS: CliOptions = {
  city: "baia-mare",
  intervalMs: 5000,
  baseUrl: "http://localhost:3001",
  forceCalls: false,
};

// ==============================
// Utils
// ==============================
function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function normalizePositiveInt(
  raw: string | undefined,
  fallback: number,
): number {
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
    } else if (flag === "--interval") {
      out.intervalMs = normalizePositiveInt(value, DEFAULTS.intervalMs);
      i += 1;
    } else if (
      flag === "--base-url" &&
      typeof value === "string" &&
      value.trim()
    ) {
      out.baseUrl = value.trim().replace(/\/+$/, "");
      i += 1;
    } else if (flag === "--force-calls") {
      out.forceCalls = true;
    }
  }

  return out;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomPoint(center: GeoCenter): { lat: number; lng: number } {
  return {
    lat: center.lat + randomBetween(-SPREAD_LAT, SPREAD_LAT),
    lng: center.lng + randomBetween(-SPREAD_LNG, SPREAD_LNG),
  };
}

// Pauza din bucla principală: ține procesul în viață.
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Pauza din ciclul de viață al unei comenzi: nu ține procesul în viață după oprire (timer unref).
function sleepBackground(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref();
  });
}

function shortId(orderId: string): string {
  return orderId.slice(0, 8);
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
    if (!isObject(data) || data.ok !== true || typeof data.token !== "string")
      return false;
    authHeaders = { authorization: `Bearer ${data.token}` };
    return true;
  } catch {
    return false;
  }
}

// ==============================
// API client
// ==============================
async function createOrder(
  opts: CliOptions,
  center: GeoCenter,
): Promise<CreatedOrder | null> {
  try {
    const res = await fetch(`${opts.baseUrl}/orders`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders },
      body: JSON.stringify({
        cityId: opts.city,
        service: "TAXI",
        pickup: randomPoint(center),
        dropoff: randomPoint(center),
      }),
    });
    const data: unknown = await res.json();
    if (!isObject(data) || data.ok !== true || typeof data.orderId !== "string")
      return null;
    return { orderId: data.orderId, dispatchOk: data.dispatch === "OK" };
  } catch {
    return null;
  }
}

async function patchStatus(
  opts: CliOptions,
  orderId: string,
  from: SimStatus,
  to: SimStatus,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${opts.baseUrl}/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", ...authHeaders },
        body: JSON.stringify({ cityId: opts.city, service: "TAXI", from, to }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function callDispatch(
  opts: CliOptions,
  orderId: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${opts.baseUrl}/orders/${encodeURIComponent(orderId)}/call`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders },
        body: JSON.stringify({
          cityId: opts.city,
          service: "TAXI",
          target: "DISPATCH",
          phoneNumber: FAKE_PHONE,
          source: "USER_APP",
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
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
      `[orders-sim] Oraș necunoscut: "${opts.city}". Orașe suportate: ${Object.keys(CITY_CENTERS).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  if (!(await authenticate(opts.baseUrl))) {
    console.error(
      "[orders-sim] Autentificare eșuată. Setează PASSWORD (parola controlcenter) sau TAXI_API_TOKEN.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `[orders-sim] city=${opts.city} baseUrl=${opts.baseUrl} interval=${opts.intervalMs}ms forceCalls=${opts.forceCalls}`,
  );
  console.log("[orders-sim] Stop: Ctrl+C (anulează comenzile rămase active)");

  let running = true;
  const stop = (): void => {
    running = false;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  // comenzi aflate în desfășurare: orderId -> ultimul status trimis
  const active = new Map<string, SimStatus>();

  // Ciclul de viață al unei comenzi: ASSIGNED -> IN_PROGRESS -> COMPLETED (sau CANCELED).
  const runLifecycle = async (order: CreatedOrder): Promise<void> => {
    const id = shortId(order.orderId);

    if (!order.dispatchOk) {
      // Fără mașini libere: utilizatorul sună dispeceratul (singurul rol al telefonului).
      // Comanda rămâne NEW — simulatorul nu inventează un flux de anulare.
      const ok = await callDispatch(opts, order.orderId);
      console.log(
        `[orders-sim] ${id} dispatch FAILED -> apel dispecerat ${ok ? "trimis" : "eșuat"}`,
      );
      return;
    }

    active.set(order.orderId, "ASSIGNED");

    if (opts.forceCalls && Math.random() < FORCED_CALL_CHANCE) {
      const ok = await callDispatch(opts, order.orderId);
      console.log(
        `[orders-sim] ${id} apel dispecerat forțat ${ok ? "trimis" : "eșuat"}`,
      );
    }

    await sleepBackground(randomBetween(4000, 8000));
    if (!running) return;

    if (Math.random() < CANCEL_CHANCE) {
      await patchStatus(opts, order.orderId, "ASSIGNED", "CANCELED");
      active.delete(order.orderId);
      console.log(`[orders-sim] ${id} ASSIGNED -> CANCELED`);
      return;
    }

    await patchStatus(opts, order.orderId, "ASSIGNED", "IN_PROGRESS");
    active.set(order.orderId, "IN_PROGRESS");
    console.log(`[orders-sim] ${id} ASSIGNED -> IN_PROGRESS`);

    await sleepBackground(randomBetween(8000, 15000));
    if (!running) return;

    await patchStatus(opts, order.orderId, "IN_PROGRESS", "COMPLETED");
    active.delete(order.orderId);
    console.log(`[orders-sim] ${id} IN_PROGRESS -> COMPLETED`);
  };

  while (running) {
    const order = await createOrder(opts, center);
    if (!order) {
      console.warn("[orders-sim] POST /orders eșuat — API-ul rulează?");
    } else {
      console.log(
        `[orders-sim] ${shortId(order.orderId)} creată, dispatch ${order.dispatchOk ? "OK" : "FAILED"}`,
      );
      void runLifecycle(order);
    }

    if (!running) break;
    await sleep(opts.intervalMs);
  }

  console.log(
    `[orders-sim] Oprire — anulez ${active.size} comenzi active (best-effort)...`,
  );
  await Promise.all(
    [...active.entries()].map(([orderId, from]) =>
      patchStatus(opts, orderId, from, "CANCELED"),
    ),
  );
  console.log("[orders-sim] done");
}

void main();

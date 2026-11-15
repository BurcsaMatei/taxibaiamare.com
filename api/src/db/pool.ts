// api/src/db/pool.ts

// ==============================
// Imports
// ==============================
import { Pool, type PoolConfig } from "pg";

// ==============================
// Config
// ==============================
// Citește DATABASE_URL (Neon, varianta *pooled*). Întoarce null dacă lipsește: API-ul pornește și fără bază
// cât timp nicio rută nu o cere (comenzile se salvează din #26).
export function getDatabaseUrl(): string | null {
  const value = process.env.DATABASE_URL?.trim();
  return value ? value : null;
}

// `pg` tratează deja sslmode=require / prefer / verify-ca ca verify-full și avertizează că se va schimba în
// versiunea următoare. Scriem explicit verify-full, ca să nu depindem de acel comportament.
// Alte valori (disable, no-verify) și URL-urile fără sslmode (ex. Postgres local) rămân neatinse.
export function resolveConnectionString(raw: string): string {
  const url = new URL(raw);
  const mode = url.searchParams.get("sslmode");
  if (mode === "require" || mode === "prefer" || mode === "verify-ca") {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

// ==============================
// Pool
// ==============================
export function createPool(connectionString: string, overrides: PoolConfig = {}): Pool {
  const pool = new Pool({
    connectionString: resolveConnectionString(connectionString),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...overrides,
  });

  // Serverul poate închide o conexiune neutilizată (ex. Neon suspendă baza după inactivitate).
  // Fără acest handler, evenimentul „error" ar opri tot procesul API.
  pool.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error(`[db] eroare pe o conexiune neutilizată: ${err.message}`);
  });

  return pool;
}

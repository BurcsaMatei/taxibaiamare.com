// api/src/modules/auth/loginRateLimit.ts

// ==============================
// Constante
// ==============================
const WINDOW_MS = 60_000;
const MAX_FAILURES = 5;

// ==============================
// State (in-memory, o singură instanță de API)
// ==============================
type Entry = { failures: number; resetAt: number };

const entries = new Map<string, Entry>();

// ==============================
// API
// ==============================
/** True dacă IP-ul a depășit limita de încercări eșuate în fereastra curentă. */
export function isLoginBlocked(key: string, nowMs: number = Date.now()): boolean {
  const e = entries.get(key);
  if (!e) return false;
  if (e.resetAt <= nowMs) {
    entries.delete(key);
    return false;
  }
  return e.failures >= MAX_FAILURES;
}

export function recordLoginFailure(key: string, nowMs: number = Date.now()): void {
  const e = entries.get(key);
  if (!e || e.resetAt <= nowMs) {
    entries.set(key, { failures: 1, resetAt: nowMs + WINDOW_MS });
    return;
  }
  e.failures += 1;
}

export function clearLoginFailures(key: string): void {
  entries.delete(key);
}

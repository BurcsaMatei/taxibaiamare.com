// controlcenter/pages/index.tsx

// ==============================
// Imports
// ==============================
import type { NextPage } from "next";
import * as React from "react";

import {
  DEFAULT_CITY_ID,
  decodeControlcenterTokenPayloadUnsafe,
  getStoredControlcenterToken,
  isControlcenterTokenExpired,
  loginControlcenter,
  setStoredControlcenterToken,
} from "../lib/auth/controlcenterAuth";
import { withBase } from "../lib/config";
import * as s from "../styles/ops/opsIndex.css";

// ==============================
// Utils
// ==============================
function goToMap(cityId: string): void {
  window.location.replace(withBase(`/ops/${encodeURIComponent(cityId)}/map`));
}

function hasValidSession(): boolean {
  const t = getStoredControlcenterToken();
  if (!t) return false;

  const payload = decodeControlcenterTokenPayloadUnsafe(t);
  return !!payload && !isControlcenterTokenExpired(payload);
}

// ==============================
// Component
// ==============================
const Home: NextPage = () => {
  const [checking, setChecking] = React.useState<boolean>(true);
  const [password, setPassword] = React.useState<string>("");
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");

  // Sesiune validă => direct pe hartă, fără ecranul de login.
  React.useEffect(() => {
    if (hasValidSession()) {
      goToMap(DEFAULT_CITY_ID);
      return;
    }
    setChecking(false);
  }, []);

  const onLogin = React.useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();

      if (!password) {
        setError("Introdu parola.");
        return;
      }

      setBusy(true);
      setError("");

      try {
        const r = await loginControlcenter(password);
        setStoredControlcenterToken(r.token);
        goToMap(r.cityId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Login failed");
        setBusy(false);
      }
    },
    [password],
  );

  return (
    <main className={s.page}>
      <section className={s.hero} aria-label="Control Center">
        <div className={s.heroInner}>
          <h1 className={s.title}>Taxi Galant</h1>
          <p className={s.subtitle}>CONTROL CENTER</p>
          <p className={s.lead}>Monitorizare și dispatch. Administrat de KonceptID.</p>
        </div>
      </section>

      <section className={s.ctaSection} aria-label="Autentificare">
        {checking ? null : (
          <div className={s.panelCard} aria-label="Login panel">
            <div className={s.panelKicker}>AUTH</div>
            <div className={s.panelTitle}>Autentificare</div>

            <form className={s.form} onSubmit={onLogin} aria-label="Login form">
              <div className={s.field}>
                <label className={s.label} htmlFor="password">
                  Parolă
                </label>
                <input
                  id="password"
                  className={s.input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <button className={s.primaryBtn} type="submit" disabled={busy}>
                {busy ? "Se verifică…" : "Intră"}
              </button>
            </form>

            {error ? (
              <div className={s.alert} role="status" aria-live="polite">
                {error}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
};

// ==============================
// Exporturi
// ==============================
export default Home;

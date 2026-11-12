// controlcenter/components/ops/auth/OpsLoginGate.tsx

// ==============================
// Imports
// ==============================
import * as React from "react";

import {
  clearStoredControlcenterToken,
  decodeControlcenterTokenPayloadUnsafe,
  getStoredControlcenterToken,
  isControlcenterTokenExpired,
  loginControlcenter,
  setStoredControlcenterToken,
} from "../../../lib/auth/controlcenterAuth";
import * as c from "../../../styles/ops/opsCityPicker.css";
import * as g from "../../../styles/ops/opsPinGate.css";

// ==============================
// Types
// ==============================
export type OpsLoginGateProps = {
  title: string;
};

// ==============================
// Component
// ==============================
export default function OpsLoginGate(props: OpsLoginGateProps): React.JSX.Element {
  const { title } = props;

  const [password, setPassword] = React.useState<string>("");
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");

  const storedToken = React.useMemo(() => getStoredControlcenterToken(), []);
  const storedPayload = React.useMemo(
    () => (storedToken ? decodeControlcenterTokenPayloadUnsafe(storedToken) : null),
    [storedToken],
  );

  const expired = storedPayload ? isControlcenterTokenExpired(storedPayload) : false;

  const onLogout = React.useCallback(() => {
    clearStoredControlcenterToken();
    setError("");
    setPassword("");
    window.location.reload();
  }, []);

  const onSubmit = React.useCallback(
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
        window.location.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Login failed");
      } finally {
        setBusy(false);
      }
    },
    [password],
  );

  return (
    <div className={g.overlay} role="dialog" aria-label="Login gate">
      <section className={`${c.card} ${g.card}`} aria-label="Control Center login">
        <h1 className={c.title}>{title}</h1>

        {expired ? (
          <div className={g.warn} role="status" aria-live="polite">
            Sesiune expirată. Autentifică-te din nou.
          </div>
        ) : null}

        <form className={c.form} onSubmit={onSubmit} aria-label="Login form">
          <label className={c.label} htmlFor="password">
            Parolă
          </label>
          <input
            id="password"
            className={c.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button className={c.btn} type="submit" disabled={busy}>
            {busy ? "Se verifică…" : "Intră"}
          </button>
        </form>

        {error ? (
          <div className={c.error} role="status" aria-live="polite">
            {error}
          </div>
        ) : null}

        <div className={g.actions}>
          <button className={g.linkBtn} type="button" onClick={onLogout}>
            Logout (șterge sesiunea)
          </button>
        </div>
      </section>
    </div>
  );
}

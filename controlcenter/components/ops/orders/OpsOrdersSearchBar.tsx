// controlcenter/components/ops/orders/OpsOrdersSearchBar.tsx

// ==============================
// Imports
// ==============================
import * as React from "react";

import * as t from "../../../styles/ops/opsOrders.css";
import type { OrderSearchCriteria } from "./opsOrders.types";
import { localInputToIso } from "./opsOrders.utils";

// ==============================
// Types
// ==============================
export type OpsOrdersSearchBarProps = {
  busy: boolean;
  // true cât timp tabelul arată rezultatele unei căutări (nu modul live)
  active: boolean;
  onSearch: (criteria: OrderSearchCriteria) => void;
  onReset: () => void;
};

// ==============================
// Component
// ==============================
export default function OpsOrdersSearchBar(props: OpsOrdersSearchBarProps): React.JSX.Element {
  const { busy, active, onSearch, onReset } = props;

  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [vehicle, setVehicle] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  const submit = (ev: React.FormEvent<HTMLFormElement>): void => {
    ev.preventDefault();

    const fromIso = localInputToIso(from);
    const toIso = localInputToIso(to);

    if (from.trim() && !fromIso) {
      setFormError("Data de început nu este validă.");
      return;
    }
    if (to.trim() && !toIso) {
      setFormError("Data de sfârșit nu este validă.");
      return;
    }
    if (fromIso && toIso && Date.parse(fromIso) >= Date.parse(toIso)) {
      setFormError("Începutul perioadei trebuie să fie înaintea sfârșitului.");
      return;
    }

    const criteria: OrderSearchCriteria = {};
    if (fromIso) criteria.from = fromIso;
    if (toIso) criteria.to = toIso;

    const vehicleId = vehicle.trim();
    if (vehicleId) criteria.vehicleId = vehicleId;

    setFormError(null);
    onSearch(criteria);
  };

  const reset = (): void => {
    setFrom("");
    setTo("");
    setVehicle("");
    setFormError(null);
    onReset();
  };

  return (
    <form className={t.toolbar} onSubmit={submit} aria-label="Căutare comenzi">
      <div className={t.field}>
        <label className={t.fieldLabel} htmlFor="orders-search-from">
          De la
        </label>
        <input
          id="orders-search-from"
          className={t.input}
          type="datetime-local"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>

      <div className={t.field}>
        <label className={t.fieldLabel} htmlFor="orders-search-to">
          Până la
        </label>
        <input
          id="orders-search-to"
          className={t.input}
          type="datetime-local"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      <div className={t.field}>
        <label className={t.fieldLabel} htmlFor="orders-search-vehicle">
          Indicativ
        </label>
        <input
          id="orders-search-vehicle"
          className={t.input}
          type="text"
          autoComplete="off"
          placeholder="ex. 05"
          value={vehicle}
          onChange={(e) => setVehicle(e.target.value)}
        />
      </div>

      <button type="submit" className={`${t.button} ${t.buttonPrimary}`} disabled={busy}>
        {busy ? "Se caută…" : "Caută"}
      </button>

      {active ? (
        <button type="button" className={t.button} onClick={reset} disabled={busy}>
          Înapoi la live
        </button>
      ) : null}

      {formError ? (
        <span className={t.small} role="alert">
          {formError}
        </span>
      ) : null}
    </form>
  );
}

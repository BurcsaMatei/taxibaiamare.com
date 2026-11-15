// controlcenter/components/ops/orders/OpsOrdersPage.tsx

// ==============================
// Imports
// ==============================
import type { Order, RealtimeEnvelope } from "@taxi/shared";
import { isActiveOrderStatus, LIST_ORDERS_MAX_LIMIT, topics } from "@taxi/shared";
import * as React from "react";

import {
  decodeControlcenterTokenPayloadUnsafe,
  getStoredControlcenterToken,
  isControlcenterTokenExpired,
} from "../../../lib/auth/controlcenterAuth";
import { fetchOrders, type OrdersQuery } from "../../../lib/orders/ordersClient";
import { useControlcenterTopicEvents } from "../../../lib/realtime/controlcenterWs";
import * as hud from "../../../styles/ops/opsHudTop.css";
import * as t from "../../../styles/ops/opsOrders.css";
import ThemeSwitcher from "../../ThemeSwitcher";
import OpsLoginGate from "../auth/OpsLoginGate";
import OpsCitySwitcher from "../cities/OpsCitySwitcher";
import OpsPageNav from "../OpsPageNav";
import type {
  OrderRow,
  OrderSearchCriteria,
  VehiclePoint,
  VehiclePresence,
  VehicleUiStatus,
} from "./opsOrders.types";
import {
  buildLiveRows,
  computeVehicleOnlineNow,
  dispatchDetailRo,
  fmtPoint,
  getVehiclePoint,
  getVehiclePresence,
  orderToRow,
  parseIsoMs,
  STATUS_LABEL_RO,
  toDateTimeParts,
  VEHICLE_STATUS_LABEL_RO,
} from "./opsOrders.utils";
import OpsOrdersSearchBar from "./OpsOrdersSearchBar";

// ==============================
// Constante
// ==============================
const EMPTY_EVENTS: ReadonlyArray<RealtimeEnvelope> = [];
const EMPTY_ORDERS: ReadonlyArray<Order> = [];
const PAGE_TITLE = "CENTRU DE CONTROL / COMENZI";

// ==============================
// Types
// ==============================
export type OpsOrdersPageProps = {
  cityId: string;
};

// Starea cererilor poartă orașul pentru care a fost făcută: la schimbarea orașului, un rezultat vechi pur și
// simplu nu se mai potrivește și dispare, fără să resetăm nimic din efecte.
type SnapshotData = { cityId: string; orders: ReadonlyArray<Order> };

type CityMessage = { cityId: string; message: string };

type SearchResult = {
  cityId: string;
  rows: OrderRow[];
  hasMore: boolean;
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "eroare necunoscută";
}

// ==============================
// Component
// ==============================
export default function OpsOrdersPage(props: OpsOrdersPageProps): React.JSX.Element {
  const cityId = props.cityId;

  // ------------------------------
  // Auth
  // ------------------------------
  const [token, setToken] = React.useState<string | null>(null);
  const [payloadScope, setPayloadScope] = React.useState<"hq" | "city" | null>(null);
  const [payloadCityId, setPayloadCityId] = React.useState<string | null>(null);
  const [tokenExpired, setTokenExpired] = React.useState<boolean>(false);

  React.useEffect(() => {
    const t2 = getStoredControlcenterToken();
    setToken(t2);

    if (!t2) {
      setPayloadScope(null);
      setPayloadCityId(null);
      setTokenExpired(false);
      return;
    }

    const payload = decodeControlcenterTokenPayloadUnsafe(t2);
    if (!payload) {
      setPayloadScope(null);
      setPayloadCityId(null);
      setTokenExpired(true);
      return;
    }

    setPayloadScope(payload.scope);
    setPayloadCityId(typeof payload.cityId === "string" ? payload.cityId : null);
    setTokenExpired(isControlcenterTokenExpired(payload));
  }, []);

  const isHq = payloadScope === "hq";
  const mismatch = payloadScope === "city" && payloadCityId ? payloadCityId !== cityId : false;
  const wsEnabled = !!token && !tokenExpired && !mismatch;

  // ------------------------------
  // WS (hook always called)
  // ------------------------------
  const topic = topics.controlcenter(cityId);
  const ws = useControlcenterTopicEvents(topic, {
    enabled: wsEnabled,
    ...(token ? { authToken: token } : {}),
  });

  const connected = wsEnabled ? ws.connected : false;
  const ready = wsEnabled ? ws.ready : false;
  const lastError = wsEnabled ? ws.lastError : null;
  const eventsSafe = wsEnabled ? ws.events : EMPTY_EVENTS;

  // Abonat = serverul a confirmat topicul. De aici încolo orice comandă nouă ajunge prin evenimente,
  // deci poza din baza de date se cere abia acum: ce s-a întâmplat înainte e în poză, ce urmează e în evenimente.
  const subscribed = wsEnabled && ws.topic === topic;

  // ------------------------------
  // Poza din baza de date (modul live)
  // ------------------------------
  const [snapshotData, setSnapshotData] = React.useState<SnapshotData | null>(null);
  const [snapshotErr, setSnapshotErr] = React.useState<CityMessage | null>(null);
  const [reloadTick, setReloadTick] = React.useState(0);
  const snapshotSeq = React.useRef(0);

  React.useEffect(() => {
    if (!subscribed || !token) return;

    snapshotSeq.current += 1;
    const seq = snapshotSeq.current;

    fetchOrders(token, { cityId })
      .then((page) => {
        if (seq !== snapshotSeq.current) return;
        setSnapshotData({ cityId, orders: page.orders });
        setSnapshotErr(null);
      })
      .catch((e: unknown) => {
        if (seq !== snapshotSeq.current) return;
        setSnapshotErr({ cityId, message: errorMessage(e) });
      });
  }, [subscribed, token, cityId, reloadTick]);

  const reloadSnapshot = React.useCallback(() => {
    setSnapshotErr(null);
    setReloadTick((n) => n + 1);
  }, []);

  const snapshotOrders =
    snapshotData && snapshotData.cityId === cityId ? snapshotData.orders : null;
  const snapshotFailure = snapshotErr && snapshotErr.cityId === cityId ? snapshotErr.message : null;
  const snapshotLoading = snapshotOrders === null && snapshotFailure === null;

  // ------------------------------
  // Căutare (perioadă + indicativ)
  // ------------------------------
  const [searchResult, setSearchResult] = React.useState<SearchResult | null>(null);
  const [searchErr, setSearchErr] = React.useState<CityMessage | null>(null);
  const [searchBusy, setSearchBusy] = React.useState(false);
  const searchSeq = React.useRef(0);

  const activeSearch = searchResult && searchResult.cityId === cityId ? searchResult : null;
  const searchError = searchErr && searchErr.cityId === cityId ? searchErr.message : null;

  const runSearch = React.useCallback(
    (criteria: OrderSearchCriteria) => {
      if (!token) return;

      searchSeq.current += 1;
      const seq = searchSeq.current;

      const query: OrdersQuery = { cityId, limit: LIST_ORDERS_MAX_LIMIT };
      if (criteria.from) query.from = criteria.from;
      if (criteria.to) query.to = criteria.to;
      if (criteria.vehicleId) query.vehicleId = criteria.vehicleId;

      setSearchBusy(true);
      setSearchErr(null);

      fetchOrders(token, query)
        .then((page) => {
          if (seq !== searchSeq.current) return;
          setSearchResult({ cityId, rows: page.orders.map(orderToRow), hasMore: page.hasMore });
          setSearchBusy(false);
        })
        .catch((e: unknown) => {
          if (seq !== searchSeq.current) return;
          setSearchErr({ cityId, message: errorMessage(e) });
          setSearchBusy(false);
        });
    },
    [token, cityId],
  );

  const resetSearch = React.useCallback(() => {
    searchSeq.current += 1;
    setSearchResult(null);
    setSearchErr(null);
    setSearchBusy(false);
  }, []);

  // ------------------------------
  // Derived (hooks UNCONDITIONAL)
  // ------------------------------
  const nowMs = Date.now();

  const latestPresenceById = React.useMemo(() => {
    const byId = new Map<string, VehiclePresence>();

    for (const e of eventsSafe) {
      const vp = getVehiclePresence(e, cityId);
      if (!vp) continue;

      const prev = byId.get(vp.vehicleId);
      if (!prev || parseIsoMs(vp.ts) >= parseIsoMs(prev.ts)) byId.set(vp.vehicleId, vp);
    }

    return byId;
  }, [cityId, eventsSafe]);

  const latestPointById = React.useMemo(() => {
    const byId = new Map<string, VehiclePoint>();

    for (const e of eventsSafe) {
      const p = getVehiclePoint(e, cityId);
      if (!p) continue;

      const prev = byId.get(p.vehicleId);
      if (!prev || parseIsoMs(p.ts) >= parseIsoMs(prev.ts)) byId.set(p.vehicleId, p);
    }

    return byId;
  }, [cityId, eventsSafe]);

  const liveRows = React.useMemo(
    () => buildLiveRows(snapshotOrders ?? EMPTY_ORDERS, eventsSafe, cityId),
    [snapshotOrders, eventsSafe, cityId],
  );

  // Un vehicul e ocupat dacă are o comandă activă (din bază sau din evenimente).
  const busyVehicleIds = React.useMemo(() => {
    const busy = new Set<string>();

    for (const r of liveRows) {
      if (r.indicativ && isActiveOrderStatus(r.status)) busy.add(r.indicativ);
    }

    return busy;
  }, [liveRows]);

  const searching = activeSearch !== null;
  const rows: ReadonlyArray<OrderRow> = activeSearch ? activeSearch.rows : liveRows;

  // Starea vehiculului contează doar pentru o comandă activă, în modul live (prezența vine din evenimente).
  // Pentru o comandă încheiată sau în rezultate de căutare, un „Offline" ar induce în eroare.
  const getVehicleStatusForRow = React.useCallback(
    (r: OrderRow): VehicleUiStatus | "—" => {
      if (searching || !r.indicativ || !isActiveOrderStatus(r.status)) return "—";

      const online = computeVehicleOnlineNow(
        r.indicativ,
        nowMs,
        latestPointById,
        latestPresenceById,
      );
      if (!online) return "OFFLINE";

      return busyVehicleIds.has(r.indicativ) ? "BUSY" : "AVAILABLE";
    },
    [searching, busyVehicleIds, latestPointById, latestPresenceById, nowMs],
  );

  // ------------------------------
  // Render (AFTER hooks)
  // ------------------------------
  if (!wsEnabled) {
    return <OpsLoginGate title={PAGE_TITLE} />;
  }

  const emptyText = searching
    ? "Nicio comandă găsită pentru criteriile alese."
    : snapshotLoading
      ? "Se încarcă comenzile…"
      : "Nicio comandă de afișat.";

  return (
    <main className={hud.page}>
      <header className={hud.topHud} aria-label="Comenzi">
        <div className={hud.brand}>
          <div className={hud.brandTitle}>Taxi Galant</div>
          <div className={hud.pageTitle}>{PAGE_TITLE}</div>
        </div>

        <div className={hud.right}>
          <div className={hud.pills}>
            <span className={hud.pill}>
              <span className={`${hud.dot} ${connected ? hud.dotOn : ""}`} aria-hidden="true" />
              {connected ? "CONECTAT" : "DECONECTAT"}
            </span>

            <span className={hud.pillMuted}>pregătit {ready ? "da" : "nu"}</span>
            <span className={hud.pillMuted}>
              oraș <span className={hud.mono}>{cityId}</span>
            </span>
            <span className={hud.pillMuted}>
              canal <span className={hud.mono}>{topic}</span>
            </span>

            <span className={hud.pillMuted}>eroare {lastError ?? "—"}</span>
          </div>

          <OpsPageNav cityId={cityId} current="orders" />

          {isHq && token ? (
            <OpsCitySwitcher authToken={token} currentCityId={cityId} mode="orders" />
          ) : null}

          <ThemeSwitcher />
        </div>
      </header>

      <section className={hud.tableArea} aria-label="Tabelul comenzilor" data-full-bleed="true">
        <OpsOrdersSearchBar
          busy={searchBusy}
          active={searching}
          onSearch={runSearch}
          onReset={resetSearch}
        />

        {searchError ? (
          <div className={t.notice} role="alert">
            Căutarea a eșuat: {searchError}
          </div>
        ) : null}

        {activeSearch ? (
          <div className={t.notice}>
            <span>
              Rezultate căutare: {activeSearch.rows.length}{" "}
              {activeSearch.rows.length === 1 ? "comandă" : "comenzi"}.
            </span>
            {activeSearch.hasMore ? (
              <span>
                Mai există rezultate dincolo de limita de {LIST_ORDERS_MAX_LIMIT}: restrânge
                perioada sau adaugă indicativul.
              </span>
            ) : null}
          </div>
        ) : null}

        {!searching && snapshotFailure ? (
          <div className={t.notice} role="alert">
            <span>
              Nu am putut încărca comenzile din baza de date ({snapshotFailure}). Apar doar
              comenzile noi, în timp real.
            </span>
            <button type="button" className={t.button} onClick={reloadSnapshot}>
              Reîncearcă
            </button>
          </div>
        ) : null}

        <div className={t.tableWrapFullBleed}>
          {rows.length === 0 ? (
            <div className={t.empty}>{emptyText}</div>
          ) : (
            <table className={t.table}>
              <thead className={t.thead}>
                <tr>
                  <th className={t.th}>Data</th>
                  <th className={t.th}>Ora</th>
                  <th className={t.th}>Preluare</th>
                  <th className={t.th}>Destinație</th>
                  <th className={t.th}>Indicativ</th>
                  <th className={t.th}>Vehicul</th>
                  <th className={t.th}>Dispecerat</th>
                  <th className={t.th}>Apel</th>
                  <th className={t.th}>Comandă</th>
                  <th className={t.th}>Status</th>
                  <th className={t.th}>Actualizat</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const created = toDateTimeParts(r.createdAtIso);
                  const updated = toDateTimeParts(r.updatedAtIso);
                  const vStatus = getVehicleStatusForRow(r);
                  const called = r.calledAtIso ? toDateTimeParts(r.calledAtIso) : null;
                  const dispatchDetail = dispatchDetailRo(r.dispatchReason);

                  return (
                    <tr key={r.orderId} className={t.trHover}>
                      <td className={`${t.td} ${t.cellMono}`}>{created.date}</td>
                      <td className={`${t.td} ${t.cellMono}`}>{created.time}</td>

                      <td className={`${t.td} ${t.cellMono}`}>{fmtPoint(r.pickup)}</td>
                      <td className={`${t.td} ${t.cellMono}`}>{fmtPoint(r.dropoff)}</td>

                      <td className={`${t.td} ${t.cellMono}`}>{r.indicativ ?? "—"}</td>

                      <td className={t.td}>
                        {vStatus === "—" ? (
                          <span className={t.cellMono}>—</span>
                        ) : (
                          <span className={t.badge}>{VEHICLE_STATUS_LABEL_RO[vStatus]}</span>
                        )}
                      </td>

                      <td className={t.td}>
                        {r.dispatch === "—" ? (
                          <span className={t.cellMono}>—</span>
                        ) : r.dispatch === "OK" ? (
                          <span className={t.badge}>Alocat</span>
                        ) : (
                          <div className={t.rowSplit}>
                            <span className={t.badge}>Fără mașină liberă</span>
                            {dispatchDetail ? (
                              <span className={t.small}>{dispatchDetail}</span>
                            ) : null}
                          </div>
                        )}
                      </td>

                      <td className={t.td}>
                        {!called ? (
                          <span className={t.cellMono}>—</span>
                        ) : (
                          <div className={t.rowSplit}>
                            <span className={t.badge}>Sunat</span>
                            <span className={t.small}>
                              {called.date} {called.time} · {r.calledPhone ?? "—"} ·{" "}
                              {r.calledSource ?? "USER_APP"}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className={`${t.td} ${t.cellMono}`}>{r.orderId}</td>

                      <td className={t.td}>
                        <span className={t.badge}>{STATUS_LABEL_RO[r.status]}</span>
                      </td>

                      <td className={`${t.td} ${t.cellMono}`}>
                        {updated.date} {updated.time}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}

// controlcenter/components/ops/orders/OpsOrdersPage.tsx

// ==============================
// Imports
// ==============================
import type { GeoPoint, OrderStatus, RealtimeEnvelope } from "@taxi/shared";
import { isActiveOrderStatus, topics } from "@taxi/shared";
import * as React from "react";

import {
  decodeControlcenterTokenPayloadUnsafe,
  getStoredControlcenterToken,
  isControlcenterTokenExpired,
} from "../../../lib/auth/controlcenterAuth";
import { useControlcenterTopicEvents } from "../../../lib/realtime/controlcenterWs";
import * as hud from "../../../styles/ops/opsHudTop.css";
import * as t from "../../../styles/ops/opsOrders.css";
import ThemeSwitcher from "../../ThemeSwitcher";
import OpsLoginGate from "../auth/OpsLoginGate";
import OpsCitySwitcher from "../cities/OpsCitySwitcher";

// ==============================
// Constante
// ==============================
const ONLINE_TTL_MS = 60_000;
const EMPTY_EVENTS: ReadonlyArray<RealtimeEnvelope> = [];

// ==============================
// Types
// ==============================
export type OpsOrdersPageProps = {
  cityId: string;
};

type DispatchFail = {
  orderId: string;
  reason: string;
  ts: string;
};

type CallSnap = {
  orderId: string;
  phoneNumber: string;
  source: string;
  ts: string;
};

type OrderRow = {
  orderId: string;
  createdAtIso: string;
  updatedAtIso: string;
  status: OrderStatus;

  userId: string | null;
  notes: string | null;
  indicativ: string | null;

  dispatch: "OK" | "FAILED" | "—";
  dispatchReason: string | null;

  calledAtIso: string | null;
  calledPhone: string | null;
  calledSource: string | null;

  pickup: GeoPoint;
  dropoff: GeoPoint;
};

type VehiclePoint = {
  vehicleId: string;
  ts: string;
};

type VehiclePresence = {
  vehicleId: string;
  online: boolean;
  ts: string;
};

type OrderAssigned = {
  orderId: string;
  vehicleId: string;
  ts: string;
};

type OrderStatusSnap = {
  orderId: string;
  status: OrderStatus;
  ts: string;
};

type VehicleUiStatus = "OFFLINE" | "AVAILABLE" | "BUSY";

// ==============================
// Utils
// ==============================
function toDateTimeParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: "" };

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");

  return { date: `${y}-${m}-${dd}`, time: `${hh}:${mm}:${ss}` };
}

function fmtPoint(p: GeoPoint): string {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}

function parseIsoMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Date.now();
}

function getVehiclePoint(e: RealtimeEnvelope, cityId: string): VehiclePoint | null {
  if (e.name !== "vehicle.locationUpdated") return null;
  if (e.payload.cityId !== cityId) return null;
  return { vehicleId: e.payload.vehicleId, ts: e.ts };
}

function getVehiclePresence(e: RealtimeEnvelope, cityId: string): VehiclePresence | null {
  if (e.name !== "vehicle.presenceChanged") return null;
  if (e.payload.cityId !== cityId) return null;
  return { vehicleId: e.payload.vehicleId, online: e.payload.online, ts: e.ts };
}

function getOrderAssigned(e: RealtimeEnvelope, cityId: string): OrderAssigned | null {
  if (e.name !== "order.assigned") return null;
  if (e.payload.cityId !== cityId) return null;
  return { orderId: e.payload.orderId, vehicleId: e.payload.vehicleId, ts: e.ts };
}

function getOrderStatusSnap(e: RealtimeEnvelope, cityId: string): OrderStatusSnap | null {
  if (e.name === "order.created") {
    if (e.payload.cityId !== cityId) return null;
    return { orderId: e.payload.orderId, status: e.payload.status, ts: e.ts };
  }

  if (e.name === "order.statusChanged") {
    if (e.payload.cityId !== cityId) return null;
    return { orderId: e.payload.orderId, status: e.payload.toStatus, ts: e.ts };
  }

  return null;
}

function getDispatchFail(e: RealtimeEnvelope, cityId: string): DispatchFail | null {
  if (e.name !== "order.dispatchFailed") return null;

  const payload = e.payload as unknown;
  if (!payload || typeof payload !== "object") return null;

  const p = payload as { orderId?: unknown; cityId?: unknown; reason?: unknown };
  if (p.cityId !== cityId) return null;
  if (typeof p.orderId !== "string" || p.orderId.trim().length === 0) return null;

  const reason = typeof p.reason === "string" && p.reason.trim().length > 0 ? p.reason : "UNKNOWN";
  return { orderId: p.orderId, reason, ts: e.ts };
}

function getCallSnap(e: RealtimeEnvelope, cityId: string): CallSnap | null {
  if (e.name !== "order.userCalledDispatch") return null;

  const payload = e.payload as unknown;
  if (!payload || typeof payload !== "object") return null;

  const p = payload as {
    orderId?: unknown;
    cityId?: unknown;
    phoneNumber?: unknown;
    source?: unknown;
  };

  if (p.cityId !== cityId) return null;
  if (typeof p.orderId !== "string" || p.orderId.trim().length === 0) return null;

  const phoneNumber = typeof p.phoneNumber === "string" ? p.phoneNumber.trim() : "";
  const source = typeof p.source === "string" ? p.source.trim() : "";
  if (!phoneNumber) return null;

  return { orderId: p.orderId, phoneNumber, source: source || "USER_APP", ts: e.ts };
}

function applyEnvelopeToRows(
  map: Map<string, OrderRow>,
  env: RealtimeEnvelope,
  cityId: string,
): void {
  if (env.name === "order.created") {
    if (env.payload.cityId !== cityId) return;

    const { orderId, pickup, dropoff, status } = env.payload;

    map.set(orderId, {
      orderId,
      createdAtIso: env.ts,
      updatedAtIso: env.ts,
      status,

      userId: null,
      notes: null,
      indicativ: null,

      dispatch: "—",
      dispatchReason: null,

      calledAtIso: null,
      calledPhone: null,
      calledSource: null,

      pickup,
      dropoff,
    });

    return;
  }

  if (env.name === "order.dispatchFailed") {
    const f = getDispatchFail(env, cityId);
    if (!f) return;

    const prev = map.get(f.orderId);
    if (!prev) {
      map.set(f.orderId, {
        orderId: f.orderId,
        createdAtIso: f.ts,
        updatedAtIso: f.ts,
        status: "NEW",

        userId: null,
        notes: null,
        indicativ: null,

        dispatch: "FAILED",
        dispatchReason: f.reason,

        calledAtIso: null,
        calledPhone: null,
        calledSource: null,

        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 0, lng: 0 },
      });
      return;
    }

    map.set(f.orderId, {
      ...prev,
      updatedAtIso: f.ts,
      dispatch: "FAILED",
      dispatchReason: f.reason,
    });

    return;
  }

  if (env.name === "order.userCalledDispatch") {
    const c = getCallSnap(env, cityId);
    if (!c) return;

    const prev = map.get(c.orderId);
    if (!prev) {
      map.set(c.orderId, {
        orderId: c.orderId,
        createdAtIso: c.ts,
        updatedAtIso: c.ts,
        status: "NEW",

        userId: null,
        notes: null,
        indicativ: null,

        dispatch: "—",
        dispatchReason: null,

        calledAtIso: c.ts,
        calledPhone: c.phoneNumber,
        calledSource: c.source,

        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 0, lng: 0 },
      });
      return;
    }

    map.set(c.orderId, {
      ...prev,
      updatedAtIso: c.ts,
      calledAtIso: c.ts,
      calledPhone: c.phoneNumber,
      calledSource: c.source,
    });

    return;
  }

  if (env.name === "order.assigned") {
    if (env.payload.cityId !== cityId) return;

    const { orderId, vehicleId } = env.payload;
    const prev = map.get(orderId);

    if (!prev) {
      map.set(orderId, {
        orderId,
        createdAtIso: env.ts,
        updatedAtIso: env.ts,
        status: "NEW",

        userId: null,
        notes: null,
        indicativ: vehicleId,

        dispatch: "OK",
        dispatchReason: null,

        calledAtIso: null,
        calledPhone: null,
        calledSource: null,

        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 0, lng: 0 },
      });
      return;
    }

    map.set(orderId, {
      ...prev,
      updatedAtIso: env.ts,
      indicativ: vehicleId,
      dispatch: "OK",
      dispatchReason: null,
    });

    return;
  }

  if (env.name === "order.statusChanged") {
    if (env.payload.cityId !== cityId) return;

    const { orderId, toStatus } = env.payload;
    const prev = map.get(orderId);

    if (!prev) {
      map.set(orderId, {
        orderId,
        createdAtIso: env.ts,
        updatedAtIso: env.ts,
        status: toStatus,

        userId: null,
        notes: null,
        indicativ: null,

        dispatch: "—",
        dispatchReason: null,

        calledAtIso: null,
        calledPhone: null,
        calledSource: null,

        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 0, lng: 0 },
      });
      return;
    }

    map.set(orderId, {
      ...prev,
      updatedAtIso: env.ts,
      status: toStatus,
    });
  }
}

function computeVehicleOnlineNow(
  vehicleId: string,
  nowMs: number,
  latestPointById: Map<string, VehiclePoint>,
  latestPresenceById: Map<string, VehiclePresence>,
): boolean {
  const p = latestPointById.get(vehicleId);
  if (!p) return false;

  const pMs = parseIsoMs(p.ts);
  if (nowMs - pMs > ONLINE_TTL_MS) return false;

  const pres = latestPresenceById.get(vehicleId);
  if (pres) {
    const presMs = parseIsoMs(pres.ts);
    if (pres.online === false && nowMs - presMs <= ONLINE_TTL_MS) return false;
  }

  return true;
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

  // ------------------------------
  // Derived maps (hooks UNCONDITIONAL)
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

  const latestAssignedByOrderId = React.useMemo(() => {
    const byOrder = new Map<string, OrderAssigned>();

    for (const e of eventsSafe) {
      const a = getOrderAssigned(e, cityId);
      if (!a) continue;

      const prev = byOrder.get(a.orderId);
      if (!prev || parseIsoMs(a.ts) >= parseIsoMs(prev.ts)) byOrder.set(a.orderId, a);
    }

    return byOrder;
  }, [cityId, eventsSafe]);

  const latestStatusByOrderId = React.useMemo(() => {
    const byOrder = new Map<string, OrderStatusSnap>();

    for (const e of eventsSafe) {
      const s2 = getOrderStatusSnap(e, cityId);
      if (!s2) continue;

      const prev = byOrder.get(s2.orderId);
      if (!prev || parseIsoMs(s2.ts) >= parseIsoMs(prev.ts)) byOrder.set(s2.orderId, s2);
    }

    return byOrder;
  }, [cityId, eventsSafe]);

  const busyVehicleIds = React.useMemo(() => {
    const busy = new Set<string>();

    for (const a of latestAssignedByOrderId.values()) {
      const st = latestStatusByOrderId.get(a.orderId);
      const status = st?.status ?? "ASSIGNED";
      if (isActiveOrderStatus(status)) busy.add(a.vehicleId);
    }

    return busy;
  }, [latestAssignedByOrderId, latestStatusByOrderId]);

  const rows = React.useMemo(() => {
    const map = new Map<string, OrderRow>();

    for (const e of eventsSafe) {
      if (
        e.name !== "order.created" &&
        e.name !== "order.statusChanged" &&
        e.name !== "order.assigned" &&
        e.name !== "order.dispatchFailed" &&
        e.name !== "order.userCalledDispatch"
      )
        continue;

      applyEnvelopeToRows(map, e, cityId);
    }

    const list = Array.from(map.values());
    list.sort((a, b) => (a.updatedAtIso < b.updatedAtIso ? 1 : -1));
    return list;
  }, [cityId, eventsSafe]);

  const getVehicleStatusForRow = React.useCallback(
    (r: OrderRow): VehicleUiStatus | "—" => {
      if (!r.indicativ) return "—";

      const online = computeVehicleOnlineNow(
        r.indicativ,
        nowMs,
        latestPointById,
        latestPresenceById,
      );
      if (!online) return "OFFLINE";

      return busyVehicleIds.has(r.indicativ) ? "BUSY" : "AVAILABLE";
    },
    [busyVehicleIds, latestPointById, latestPresenceById, nowMs],
  );

  // ------------------------------
  // Render (AFTER hooks)
  // ------------------------------
  if (!wsEnabled) {
    return <OpsLoginGate title="CONTROL CENTER / ORDERS" />;
  }

  return (
    <main className={hud.page}>
      <header className={hud.topHud} aria-label="Orders HUD">
        <div className={hud.brand}>
          <div className={hud.brandTitle}>Taxi Galant</div>
          <div className={hud.pageTitle}>CONTROL CENTER / ORDERS</div>
        </div>

        <div className={hud.right}>
          <div className={hud.pills}>
            <span className={hud.pill}>
              <span className={`${hud.dot} ${connected ? hud.dotOn : ""}`} aria-hidden="true" />
              {connected ? "CONNECTED" : "DISCONNECTED"}
            </span>

            <span className={hud.pillMuted}>ready {ready ? "true" : "false"}</span>
            <span className={hud.pillMuted}>
              city <span className={hud.mono}>{cityId}</span>
            </span>
            <span className={hud.pillMuted}>
              topic <span className={hud.mono}>{topic}</span>
            </span>

            <span className={hud.pillMuted}>error {lastError ?? "—"}</span>
          </div>

          {isHq && token ? (
            <OpsCitySwitcher authToken={token} currentCityId={cityId} mode="orders" />
          ) : null}

          <ThemeSwitcher />
        </div>
      </header>

      <section className={hud.tableArea} aria-label="Realtime orders table" data-full-bleed="true">
        <div className={t.tableWrapFullBleed}>
          {rows.length === 0 ? (
            <div className={t.empty}>No events yet. Trimite POST /orders pe API.</div>
          ) : (
            <table className={t.table}>
              <thead className={t.thead}>
                <tr>
                  <th className={t.th}>Date</th>
                  <th className={t.th}>Time</th>
                  <th className={t.th}>User</th>
                  <th className={t.th}>Pickup</th>
                  <th className={t.th}>Dropoff</th>
                  <th className={t.th}>Notes</th>
                  <th className={t.th}>Indicativ</th>
                  <th className={t.th}>Vehicle</th>
                  <th className={t.th}>Dispatch</th>
                  <th className={t.th}>Call</th>
                  <th className={t.th}>Order</th>
                  <th className={t.th}>Status</th>
                  <th className={t.th}>Updated</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const created = toDateTimeParts(r.createdAtIso);
                  const updated = toDateTimeParts(r.updatedAtIso);
                  const vStatus = getVehicleStatusForRow(r);
                  const called = r.calledAtIso ? toDateTimeParts(r.calledAtIso) : null;

                  return (
                    <tr key={r.orderId} className={t.trHover}>
                      <td className={`${t.td} ${t.cellMono}`}>{created.date}</td>
                      <td className={`${t.td} ${t.cellMono}`}>{created.time}</td>

                      <td className={t.td}>
                        <div className={t.rowSplit}>
                          <span className={t.cellMono}>{r.userId ?? "—"}</span>
                          <span className={t.small}>future: userId</span>
                        </div>
                      </td>

                      <td className={t.td}>
                        <div className={t.rowSplit}>
                          <span className={t.cellMono}>{fmtPoint(r.pickup)}</span>
                          <span className={t.small}>pickup</span>
                        </div>
                      </td>

                      <td className={t.td}>
                        <div className={t.rowSplit}>
                          <span className={t.cellMono}>{fmtPoint(r.dropoff)}</span>
                          <span className={t.small}>dropoff</span>
                        </div>
                      </td>

                      <td className={t.td}>
                        <div className={t.rowSplit}>
                          <span className={t.cellMono}>{r.notes ?? "—"}</span>
                          <span className={t.small}>future: notes</span>
                        </div>
                      </td>

                      <td className={t.td}>
                        <div className={t.rowSplit}>
                          <span className={t.cellMono}>{r.indicativ ?? "—"}</span>
                          <span className={t.small}>realtime: order.assigned</span>
                        </div>
                      </td>

                      <td className={t.td}>
                        {vStatus === "—" ? (
                          <span className={t.cellMono}>—</span>
                        ) : (
                          <span className={t.badge}>
                            <span className={t.cellMono}>{vStatus}</span>
                          </span>
                        )}
                      </td>

                      <td className={t.td}>
                        {r.dispatch === "—" ? (
                          <span className={t.cellMono}>—</span>
                        ) : r.dispatch === "OK" ? (
                          <span className={t.badge}>
                            <span className={t.cellMono}>OK</span>
                          </span>
                        ) : (
                          <div className={t.rowSplit}>
                            <span className={t.badge}>
                              <span className={t.cellMono}>FAILED</span>
                            </span>
                            <span className={t.small}>
                              {r.dispatchReason ?? "NO_AVAILABLE_VEHICLE"}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className={t.td}>
                        {!called ? (
                          <span className={t.cellMono}>—</span>
                        ) : (
                          <div className={t.rowSplit}>
                            <span className={t.badge}>
                              <span className={t.cellMono}>CALLED</span>
                            </span>
                            <span className={t.small}>
                              {called.date} {called.time} · {r.calledPhone ?? "—"} ·{" "}
                              {r.calledSource ?? "USER_APP"}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className={`${t.td} ${t.cellMono}`}>{r.orderId}</td>

                      <td className={t.td}>
                        <span className={t.badge}>
                          <span className={t.cellMono}>{r.status}</span>
                        </span>
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

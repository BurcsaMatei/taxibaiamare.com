// controlcenter/components/ops/orders/opsOrders.utils.ts

// ==============================
// Imports
// ==============================
import type { Order, OrderStatus, RealtimeEnvelope } from "@taxi/shared";

import type { OrderRow, VehiclePoint, VehiclePresence, VehicleUiStatus } from "./opsOrders.types";

// ==============================
// Constante
// ==============================
export const ONLINE_TTL_MS = 60_000;

// Evenimentele care modifică un rând din tabel.
const ORDER_EVENT_NAMES: ReadonlySet<RealtimeEnvelope["name"]> = new Set([
  "order.created",
  "order.statusChanged",
  "order.assigned",
  "order.dispatchFailed",
  "order.userCalledDispatch",
]);

// ==============================
// Etichete (română)
// ==============================
export const STATUS_LABEL_RO: Readonly<Record<OrderStatus, string>> = {
  NEW: "Nouă",
  DISPATCHING: "În dispecerizare",
  ASSIGNED: "Alocată",
  IN_PROGRESS: "În cursă",
  COMPLETED: "Finalizată",
  CANCELED: "Anulată",
};

export const VEHICLE_STATUS_LABEL_RO: Readonly<Record<VehicleUiStatus, string>> = {
  OFFLINE: "Offline",
  AVAILABLE: "Liber",
  BUSY: "Ocupat",
};

// „Fără mașină liberă" e deja spus de etichetă; un motiv necunoscut se afișează ca atare.
export function dispatchDetailRo(reason: string | null): string | null {
  if (!reason || reason === "NO_AVAILABLE_VEHICLE") return null;
  return reason;
}

// ==============================
// Culoarea rândului
// ==============================
export type RowTone = "ok" | "failed" | "none";

// Roșu: dispecerizarea a eșuat (rămâne roșu oricare ar fi statusul de după, ex. anulată).
// Verde: comanda a fost alocată și e în curs sau încheiată cu succes.
// Fără culoare: nouă, fără rezultat încă, sau alocată și apoi anulată.
export function rowTone(r: OrderRow): RowTone {
  if (r.dispatch === "FAILED") return "failed";
  if (r.status === "ASSIGNED" || r.status === "IN_PROGRESS" || r.status === "COMPLETED")
    return "ok";
  return "none";
}

// ==============================
// Formatare
// ==============================
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Data ca 15.11.2026 și ora ca 04:21:02, în ora locală a browserului (aceeași ca în formularul de căutare).
export function toDateTimeParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: "" };

  return {
    date: `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`,
  };
}

export function fmtPoint(p: { lat: number; lng: number }): string {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}

export function parseIsoMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Date.now();
}

// Valoarea unui <input type="datetime-local"> („2026-10-28T20:00", ora locală) -> ISO UTC cu fus orar.
// Întoarce null dacă e goală sau invalidă.
export function localInputToIso(value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ==============================
// Din baza de date -> rând
// ==============================
export function orderToRow(o: Order): OrderRow {
  const dispatch: OrderRow["dispatch"] = o.assignedVehicleId
    ? "OK"
    : o.dispatchFailedReason
      ? "FAILED"
      : "—";

  return {
    orderId: o.id,
    createdAtIso: o.createdAt,
    updatedAtIso: o.updatedAt,
    status: o.status,

    indicativ: o.assignedVehicleId,

    dispatch,
    dispatchReason: o.dispatchFailedReason,

    calledAtIso: null,
    calledPhone: null,
    calledSource: null,

    pickup: o.pickup,
    dropoff: o.dropoff,
  };
}

// ==============================
// Din evenimente -> câmpuri
// ==============================
type DispatchFail = { orderId: string; reason: string; ts: string };
type CallSnap = { orderId: string; phoneNumber: string; source: string; ts: string };

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

// Un eveniment mai vechi decât starea deja încărcată din bază nu are voie să o dea înapoi
// (ex. „ASSIGNED" sosit după ce poza din bază arată deja „COMPLETED").
function isStale(prev: OrderRow, ts: string): boolean {
  const evMs = Date.parse(ts);
  const prevMs = Date.parse(prev.updatedAtIso);
  return Number.isFinite(evMs) && Number.isFinite(prevMs) && evMs < prevMs;
}

function laterIso(a: string, b: string): string {
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

// Aplică un eveniment pe harta de rânduri. Evenimentele pentru o comandă necunoscută (nici în poza din bază,
// nici văzută la creare) se ignoră: nu inventăm rânduri goale cu coordonate 0,0.
export function applyEnvelopeToRows(
  map: Map<string, OrderRow>,
  env: RealtimeEnvelope,
  cityId: string,
): void {
  if (env.name === "order.created") {
    if (env.payload.cityId !== cityId) return;

    const { orderId, pickup, dropoff, status } = env.payload;

    // deja încărcată din bază: starea ei e mai nouă decât evenimentul de creare
    if (map.has(orderId)) return;

    map.set(orderId, {
      orderId,
      createdAtIso: env.ts,
      updatedAtIso: env.ts,
      status,

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
    if (!prev || isStale(prev, f.ts)) return;

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
    if (!prev) return;

    // Apelurile nu sunt în bază, deci nu există „stare mai nouă" cu care să se bată: se aplică mereu.
    map.set(c.orderId, {
      ...prev,
      updatedAtIso: laterIso(prev.updatedAtIso, c.ts),
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
    if (!prev || isStale(prev, env.ts)) return;

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
    if (!prev || isStale(prev, env.ts)) return;

    map.set(orderId, {
      ...prev,
      updatedAtIso: env.ts,
      status: toStatus,
    });
  }
}

// Modul „live": poza din baza de date + evenimentele primite de la deschiderea paginii, cele mai recent
// modificate primele.
export function buildLiveRows(
  snapshot: ReadonlyArray<Order>,
  events: ReadonlyArray<RealtimeEnvelope>,
  cityId: string,
): OrderRow[] {
  const map = new Map<string, OrderRow>();

  for (const o of snapshot) {
    if (o.cityId === cityId) map.set(o.id, orderToRow(o));
  }

  for (const e of events) {
    if (!ORDER_EVENT_NAMES.has(e.name)) continue;
    applyEnvelopeToRows(map, e, cityId);
  }

  const list = Array.from(map.values());
  list.sort((a, b) => (a.updatedAtIso < b.updatedAtIso ? 1 : -1));
  return list;
}

// ==============================
// Vehicule (prezență live)
// ==============================
export function getVehiclePoint(e: RealtimeEnvelope, cityId: string): VehiclePoint | null {
  if (e.name !== "vehicle.locationUpdated") return null;
  if (e.payload.cityId !== cityId) return null;
  return { vehicleId: e.payload.vehicleId, ts: e.ts };
}

export function getVehiclePresence(e: RealtimeEnvelope, cityId: string): VehiclePresence | null {
  if (e.name !== "vehicle.presenceChanged") return null;
  if (e.payload.cityId !== cityId) return null;
  return { vehicleId: e.payload.vehicleId, online: e.payload.online, ts: e.ts };
}

export function computeVehicleOnlineNow(
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

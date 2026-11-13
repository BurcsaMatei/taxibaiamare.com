// controlcenter/components/ops/map/opsMap.utils.ts

// ==============================
// Imports
// ==============================
import type { CityPublic, RealtimeEnvelope } from "@taxi/shared";
import { themeClassDark, themeClassLight } from "@taxi/tokens";
import * as React from "react";

import type {
  FleetResponse,
  OrderAssigned,
  OrderStatusSnap,
  ThemeMode,
  VehiclePoint,
  VehiclePresence,
} from "./opsMap.types";

// ==============================
// Constante
// ==============================
export const ONLINE_TTL_MS = 60_000;

// ==============================
// Utils
// ==============================
function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function parseIsoMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Date.now();
}

export function fmtIsoLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${dd} ${hh}:${mm}:${ss}`;
}

export function fmtAge(nowMs: number, iso: string): string {
  const ts = parseIsoMs(iso);
  const diff = Math.max(0, nowMs - ts);

  const s2 = Math.floor(diff / 1000);
  if (s2 < 60) return `${s2}s`;
  const m = Math.floor(s2 / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function toTelHref(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  return `tel:${cleaned}`;
}

export function normalizeIndicativInput(raw: string): string {
  const s2 = raw.trim();
  if (!s2) return "";
  const digits = s2.replace(/[^\d]/g, "");
  if (!digits) return "";

  if (digits.length === 1) return `0${digits}`;
  return digits;
}

// ==============================
// Realtime event helpers
// ==============================
export function getVehiclePoint(e: RealtimeEnvelope): VehiclePoint | null {
  if (e.name !== "vehicle.locationUpdated") return null;

  const payload = e.payload as unknown;
  if (!isObject(payload)) return null;

  const vehicleId = payload.vehicleId;
  const point = payload.point;

  if (!isNonEmptyString(vehicleId)) return null;
  if (!isObject(point)) return null;

  const lng = point.lng;
  const lat = point.lat;

  if (!isFiniteNumber(lng) || !isFiniteNumber(lat)) return null;

  return { vehicleId: vehicleId.trim(), lng, lat, ts: e.ts };
}

export function getVehiclePresence(e: RealtimeEnvelope): VehiclePresence | null {
  if (e.name !== "vehicle.presenceChanged") return null;

  const payload = e.payload as unknown;
  if (!isObject(payload)) return null;

  const vehicleId = payload.vehicleId;
  const online = payload.online;

  if (!isNonEmptyString(vehicleId)) return null;
  if (typeof online !== "boolean") return null;

  return { vehicleId: vehicleId.trim(), online, ts: e.ts };
}

export function getOrderAssigned(e: RealtimeEnvelope): OrderAssigned | null {
  if (e.name !== "order.assigned") return null;

  const payload = e.payload as unknown;
  if (!isObject(payload)) return null;

  const orderId = payload.orderId;
  const vehicleId = payload.vehicleId;

  if (!isNonEmptyString(orderId)) return null;
  if (!isNonEmptyString(vehicleId)) return null;

  return { orderId: orderId.trim(), vehicleId: vehicleId.trim(), ts: e.ts };
}

export function getOrderStatusSnap(e: RealtimeEnvelope): OrderStatusSnap | null {
  if (e.name === "order.created") {
    const payload = e.payload as unknown;
    if (!isObject(payload)) return null;

    const orderId = payload.orderId;
    const status = payload.status;

    if (!isNonEmptyString(orderId)) return null;
    if (!isNonEmptyString(status)) return null;

    return { orderId: orderId.trim(), status: status as OrderStatusSnap["status"], ts: e.ts };
  }

  if (e.name === "order.statusChanged") {
    const payload = e.payload as unknown;
    if (!isObject(payload)) return null;

    const orderId = payload.orderId;
    const toStatus = payload.toStatus;

    if (!isNonEmptyString(orderId)) return null;
    if (!isNonEmptyString(toStatus)) return null;

    return { orderId: orderId.trim(), status: toStatus as OrderStatusSnap["status"], ts: e.ts };
  }

  return null;
}

// ==============================
// API fetchers (controlcenter -> proxy)
// ==============================
export async function fetchFleetDirectory(
  cityId: string,
  authToken: string,
): Promise<FleetResponse> {
  const url = `/api/fleet/${encodeURIComponent(cityId)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${authToken}` },
  });
  const data = (await res.json()) as unknown;

  if (!res.ok) throw new Error("Fleet proxy error");
  if (!isObject(data)) throw new Error("Invalid fleet response");

  const ok = data.ok;
  const vehicles = data.vehicles;

  if (ok !== true || !Array.isArray(vehicles)) throw new Error("Fleet endpoint returned error");

  return data as FleetResponse;
}

function isCityPublic(v: unknown): v is CityPublic {
  if (!isObject(v)) return false;

  if (!isNonEmptyString(v.id)) return false;
  if (!isNonEmptyString(v.name)) return false;
  if (!isNonEmptyString(v.slug)) return false;
  if (!isNonEmptyString(v.timezone)) return false;
  if (typeof v.isActive !== "boolean") return false;

  const mc = v.mapCenter;
  if (!isObject(mc)) return false;
  if (!isFiniteNumber(mc.lng) || !isFiniteNumber(mc.lat)) return false;

  if (!isFiniteNumber(v.mapZoom)) return false;

  // dispatchPhone optional
  if ("dispatchPhone" in v && v.dispatchPhone !== undefined && !isNonEmptyString(v.dispatchPhone)) {
    return false;
  }

  return true;
}

export async function fetchCity(cityId: string, authToken: string): Promise<CityPublic> {
  const url = `/api/cities/${encodeURIComponent(cityId)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${authToken}`,
    },
  });

  const data = (await res.json()) as unknown;

  if (!res.ok) throw new Error("City proxy error");
  if (!isObject(data)) throw new Error("Invalid city response");

  const ok = data.ok;
  const city = data.city;

  if (ok !== true) throw new Error("City endpoint returned error");
  if (!isCityPublic(city)) throw new Error("City endpoint returned invalid city payload");

  // normalize id/slug to lower, keep name as-is
  return {
    ...city,
    id: city.id.trim().toLowerCase(),
    slug: city.slug.trim().toLowerCase(),
  } satisfies CityPublic;
}

// ==============================
// Theme helpers
// ==============================
function readThemeMode(): ThemeMode {
  const root = document.documentElement;
  if (root.classList.contains(themeClassDark)) return "dark";
  if (root.classList.contains(themeClassLight)) return "light";
  return "dark";
}

export function useThemeMode(): ThemeMode {
  const [mode, setMode] = React.useState<ThemeMode>(() => "dark");

  React.useEffect(() => {
    setMode(readThemeMode());

    const root = document.documentElement;
    const obs = new MutationObserver(() => setMode(readThemeMode()));
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => obs.disconnect();
  }, []);

  return mode;
}

export function useNowTick(ms = 1000): number {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);

  return now;
}

// api/src/modules/dispatch/index.ts

// ==============================
// Imports
// ==============================
import type { GeoPoint } from "@taxi/shared";

import { getOnlineVehicleLocations } from "../vehicles/index.js";
import { isVehicleBusy } from "./busyVehicles.js";

// ==============================
// Types
// ==============================
export type ChooseNearestVehicleInput = {
  cityId: string;
  pickup: GeoPoint;
  nowMs?: number;
};

export type ChooseNearestVehicleResult = {
  vehicleId: string;
  distanceMeters: number;
} | null;

// ==============================
// Utils
// ==============================
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Haversine distance in meters
function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);

  const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  const d = R * c;
  return Number.isFinite(d) ? d : Number.POSITIVE_INFINITY;
}

function toVehicleNumericId(vehicleId: string): number {
  const n = Number.parseInt(vehicleId, 10);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

// ==============================
// API
// ==============================
export function chooseNearestVehicle(input: ChooseNearestVehicleInput): ChooseNearestVehicleResult {
  const cityId = input.cityId.trim();
  if (cityId.length === 0) return null;

  const nowMs = typeof input.nowMs === "number" && Number.isFinite(input.nowMs) ? input.nowMs : Date.now();

  const candidates = getOnlineVehicleLocations(cityId, nowMs);
  if (candidates.length === 0) return null;

  let best: { vehicleId: string; distanceMeters: number } | null = null;

  for (const c of candidates) {
    // vehiculele cu o comandă activă nu primesc altă comandă
    if (isVehicleBusy(cityId, c.vehicleId)) continue;

    const d = distanceMeters(input.pickup, c.point);

    if (!best) {
      best = { vehicleId: c.vehicleId, distanceMeters: d };
      continue;
    }

    if (d < best.distanceMeters) {
      best = { vehicleId: c.vehicleId, distanceMeters: d };
      continue;
    }

    // tie-break: numeric vehicleId asc (determinist)
    if (d === best.distanceMeters) {
      const cur = toVehicleNumericId(c.vehicleId);
      const prev = toVehicleNumericId(best.vehicleId);
      if (cur < prev) best = { vehicleId: c.vehicleId, distanceMeters: d };
    }
  }

  return best;
}

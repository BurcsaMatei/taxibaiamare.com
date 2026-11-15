// controlcenter/lib/orders/ordersClient.ts

// ==============================
// Imports
// ==============================
import type { Order } from "@taxi/shared";
import { isOrderStatus, isServiceTypeCode } from "@taxi/shared";

// ==============================
// Types
// ==============================
export type OrdersQuery = {
  cityId: string;
  vehicleId?: string;
  from?: string; // ISO 8601 cu fus orar (ex. 2026-10-28T17:00:00.000Z)
  to?: string; // ISO 8601 cu fus orar; exclusiv
  limit?: number;
};

export type OrdersPage = {
  orders: ReadonlyArray<Order>;
  hasMore: boolean;
};

// ==============================
// Utils
// ==============================
function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function isGeoPointLike(v: unknown): v is { lat: number; lng: number } {
  return isObject(v) && typeof v.lat === "number" && typeof v.lng === "number";
}

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

// Verifică forma unei comenzi primite de la server (guard scris de mână, ca în restul proiectului).
function isOrder(v: unknown): v is Order {
  return (
    isObject(v) &&
    typeof v.id === "string" &&
    typeof v.cityId === "string" &&
    isServiceTypeCode(v.service) &&
    isOrderStatus(v.status) &&
    isGeoPointLike(v.pickup) &&
    isGeoPointLike(v.dropoff) &&
    isNullableString(v.assignedVehicleId) &&
    isNullableString(v.dispatchFailedReason) &&
    typeof v.createdAt === "string" &&
    typeof v.updatedAt === "string"
  );
}

// ==============================
// API
// ==============================
export async function fetchOrders(authToken: string, query: OrdersQuery): Promise<OrdersPage> {
  const token = authToken.trim();
  if (!token) throw new Error("Lipsește tokenul de autentificare");

  const params = new URLSearchParams({ cityId: query.cityId });
  if (query.vehicleId) params.set("vehicleId", query.vehicleId);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.limit !== undefined) params.set("limit", String(query.limit));

  const res = await fetch(`/api/orders?${params.toString()}`, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
  });

  let data: unknown;
  try {
    data = (await res.json()) as unknown;
  } catch {
    throw new Error("Răspuns invalid de la server");
  }

  if (!isObject(data)) throw new Error("Răspuns invalid de la server");

  if (data.ok !== true) {
    const detail = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    throw new Error(detail);
  }

  if (!Array.isArray(data.orders) || typeof data.hasMore !== "boolean") {
    throw new Error("Răspuns invalid de la server");
  }

  const orders: unknown[] = data.orders;
  if (!orders.every(isOrder)) throw new Error("Răspuns invalid de la server");

  return { orders, hasMore: data.hasMore };
}

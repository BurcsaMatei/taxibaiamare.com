// packages/shared/src/contracts/orders.ts

// ==============================
// Imports
// ==============================
import type { GeoPoint } from "../domain/geo.js";
import type { Order } from "../domain/order.js";
import type { OrderStatus } from "../domain/status.js";
import type { ServiceTypeCode } from "../domain/service.js";
import type { OrderCallSource, OrderCallTarget } from "../events/realtime.js";

// ==============================
// POST /orders
// ==============================
export interface CreateOrderRequest {
  cityId: string;
  service: ServiceTypeCode;
  pickup: GeoPoint;
  dropoff: GeoPoint;
}

export type CreateOrderResponse =
  | {
      ok: true;
      orderId: string;
      status: OrderStatus;
      assignedVehicleId: string | null;
      dispatch: "OK" | "FAILED";
      reason?: string;
    }
  | { ok: false; error: string };

// ==============================
// GET /orders
// ==============================
// Parametri (query string):
//   cityId     obligatoriu
//   status     opțional, unul sau mai multe separate prin virgulă (ex. ASSIGNED,IN_PROGRESS)
//   vehicleId  opțional — indicativul vehiculului
//   from, to   opționale — ISO 8601 CU fus orar (ex. 2026-10-28T20:00:00+03:00; `+` se codează %2B în URL);
//              se caută created_at >= from și created_at < to
//   limit      opțional, implicit 50, maxim 200
// Rezultate: cele mai noi primele. `hasMore` = mai există comenzi dincolo de limită (restrânge căutarea).
export const LIST_ORDERS_DEFAULT_LIMIT = 50;
export const LIST_ORDERS_MAX_LIMIT = 200;

export type ListOrdersResponse =
  { ok: true; orders: Order[]; hasMore: boolean } | { ok: false; error: string };

// ==============================
// GET /orders/:id (orderId în URL)
// ==============================
export type GetOrderResponse = { ok: true; order: Order } | { ok: false; error: string };

// ==============================
// PATCH /orders/:id/status (orderId în URL)
// ==============================
export interface PatchOrderStatusRequest {
  cityId: string;
  from: OrderStatus;
  to: OrderStatus;
  service?: ServiceTypeCode;
}

export type PatchOrderStatusResponse =
  | { ok: true; orderId: string; from: OrderStatus; to: OrderStatus }
  | { ok: false; error: string };

// ==============================
// POST /orders/:id/call (orderId în URL)
// ==============================
export interface CallOrderRequest {
  cityId: string;
  service: ServiceTypeCode;
  target: OrderCallTarget;
  phoneNumber: string;
  source?: OrderCallSource;
}

export type CallOrderResponse = { ok: true } | { ok: false; error: string };

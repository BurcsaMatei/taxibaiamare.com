// packages/shared/src/domain/status.ts

export type DriverOnlineStatus = "OFFLINE" | "ONLINE" | "BUSY";

// Lifecycle / asset state (nu e “availability”)
export type VehicleStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";

// ==============================
// Taxi Order Status (single source of truth)
// ==============================
export const ORDER_STATUSES = [
  "NEW",
  "DISPATCHING",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Orders considered "active" -> vehicle is BUSY if assigned to any of these
export const ACTIVE_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "NEW",
  "DISPATCHING",
  "ASSIGNED",
  "IN_PROGRESS",
]);

export const FINAL_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "COMPLETED",
  "CANCELED",
]);

// Tranziții permise (sursa unică; API-ul le aplică la PATCH /orders/:id/status).
// Statusurile finale nu mai pot fi schimbate. DISPATCHING există în tip, dar fluxul de azi nu îl folosește.
export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, ReadonlyArray<OrderStatus>>> = {
  NEW: ["ASSIGNED", "CANCELED"],
  DISPATCHING: [],
  ASSIGNED: ["IN_PROGRESS", "CANCELED"],
  IN_PROGRESS: ["COMPLETED", "CANCELED"],
  COMPLETED: [],
  CANCELED: [],
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);
}

export function normalizeOrderStatus(v: unknown): OrderStatus | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toUpperCase();
  if (s.length === 0) return null;

  // strict: only our canonical spellings
  const cand = s as OrderStatus;
  return isOrderStatus(cand) ? cand : null;
}

export function isActiveOrderStatus(v: unknown): v is OrderStatus {
  return isOrderStatus(v) && ACTIVE_ORDER_STATUSES.has(v);
}

export function isFinalOrderStatus(v: unknown): v is OrderStatus {
  return isOrderStatus(v) && FINAL_ORDER_STATUSES.has(v);
}

// Payments (rămâne, dar nu intră în flow-ul taxi)
export type PaymentStatus =
  | "REQUIRES_ACTION"
  | "REQUIRES_CONFIRMATION"
  | "SUCCEEDED"
  | "FAILED"
  | "REFUNDED";

// api/src/modules/orders/repository.ts

// ==============================
// Imports
// ==============================
import type { Pool } from "pg";
import { ACTIVE_ORDER_STATUSES } from "@taxi/shared";
import type { GeoPoint, OrderStatus, ServiceTypeCode } from "@taxi/shared";

// ==============================
// Types
// ==============================
export type NewOrder = {
  id: string;
  cityId: string;
  service: ServiceTypeCode;
  status: OrderStatus;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  assignedVehicleId: string | null;
  dispatchFailedReason: string | null;
};

export type TransitionResult =
  | { kind: "ok"; service: string }
  | { kind: "not_found" }
  | { kind: "conflict"; actualStatus: string };

// ==============================
// Utils
// ==============================
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Coloana `id` e de tip uuid: un id care nu arată a uuid ar face baza să arunce eroare, nu să nu găsească nimic.
export function isOrderId(v: string): boolean {
  return UUID_RE.test(v);
}

// 23505 = unique_violation (ex. vehiculul are deja o comandă activă — vezi migrația 002).
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23505";
}

// ==============================
// Queries
// ==============================
// Vehiculele cu o comandă activă dintr-un oraș. Baza e sursa adevărului: nu se pierde la restart.
export async function listBusyVehicleIds(pool: Pool, cityId: string): Promise<Set<string>> {
  const res = await pool.query<{ assigned_vehicle_id: string }>(
    `select assigned_vehicle_id
       from orders
      where city_id = $1
        and assigned_vehicle_id is not null
        and status = any($2)`,
    [cityId, [...ACTIVE_ORDER_STATUSES]],
  );
  return new Set(res.rows.map((r) => r.assigned_vehicle_id));
}

export async function insertOrder(pool: Pool, o: NewOrder): Promise<void> {
  await pool.query(
    `insert into orders
       (id, city_id, service, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
        assigned_vehicle_id, dispatch_failed_reason)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      o.id,
      o.cityId,
      o.service,
      o.status,
      o.pickup.lat,
      o.pickup.lng,
      o.dropoff.lat,
      o.dropoff.lng,
      o.assignedVehicleId,
      o.dispatchFailedReason,
    ],
  );
}

// Schimbă statusul doar dacă statusul real din bază e `from` (o singură interogare, fără cursă).
// Dacă nu s-a schimbat nimic, deosebim „nu există" de „are alt status decât cel așteptat".
export async function transitionOrderStatus(
  pool: Pool,
  p: { orderId: string; cityId: string; from: OrderStatus; to: OrderStatus },
): Promise<TransitionResult> {
  const updated = await pool.query<{ service: string }>(
    `update orders
        set status = $4, updated_at = now()
      where id = $1 and city_id = $2 and status = $3
  returning service`,
    [p.orderId, p.cityId, p.from, p.to],
  );

  const row = updated.rows[0];
  if (row) return { kind: "ok", service: row.service };

  const current = await pool.query<{ status: string }>(
    "select status from orders where id = $1 and city_id = $2",
    [p.orderId, p.cityId],
  );

  const existing = current.rows[0];
  if (!existing) return { kind: "not_found" };
  return { kind: "conflict", actualStatus: existing.status };
}

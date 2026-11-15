// controlcenter/components/ops/orders/opsOrders.types.ts

// ==============================
// Imports
// ==============================
import type { GeoPoint, OrderStatus } from "@taxi/shared";

// ==============================
// Types
// ==============================
// Un rând din tabel. Vine din baza de date (poza) și din evenimentele live, combinate pe codul comenzii.
// Nu există coloane pentru user sau observații: nu le completează nimeni (vezi PRD.md).
export type OrderRow = {
  orderId: string;
  createdAtIso: string;
  updatedAtIso: string;
  status: OrderStatus;

  indicativ: string | null;

  dispatch: "OK" | "FAILED" | "—";
  dispatchReason: string | null;

  // Apelurile la dispecerat nu se salvează în bază: apar doar dacă au sosit cât timp pagina era deschisă.
  calledAtIso: string | null;
  calledPhone: string | null;
  calledSource: string | null;

  pickup: GeoPoint;
  dropoff: GeoPoint;
};

export type VehicleUiStatus = "OFFLINE" | "AVAILABLE" | "BUSY";

export type VehiclePoint = {
  vehicleId: string;
  ts: string;
};

export type VehiclePresence = {
  vehicleId: string;
  online: boolean;
  ts: string;
};

// Criteriile formularului de căutare, deja convertite (ISO cu fus orar).
export type OrderSearchCriteria = {
  from?: string;
  to?: string;
  vehicleId?: string;
};

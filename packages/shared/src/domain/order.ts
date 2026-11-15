import type { GeoPoint } from "./geo";
import type { OrderStatus } from "./status";
import type { ServiceTypeCode } from "./service";

// Comanda așa cum e salvată în baza de date (tabela `orders`) și cum o întoarce GET /orders.
// Datele clientului (nume, email, adrese), șoferul și prețul se adaugă prin migrații noi, când evenimentele
// din aplicații le aduc (vezi PRD.md, cerințe neîndeplinite). Fără număr de telefon.
export interface Order {
  id: string;
  cityId: string;
  service: ServiceTypeCode;
  status: OrderStatus;

  pickup: GeoPoint;
  dropoff: GeoPoint;

  // gol dacă dispecerizarea a eșuat (fără vehicul liber)
  assignedVehicleId: string | null;
  dispatchFailedReason: string | null;

  createdAt: string; // ISO 8601, UTC
  updatedAt: string; // ISO 8601, UTC
}

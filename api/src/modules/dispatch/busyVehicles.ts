// api/src/modules/dispatch/busyVehicles.ts

// ==============================
// State (in-memory, ca prezența vehiculelor)
// ==============================
// Un vehicul e „ocupat" cât timp are o comandă activă (atribuită și nefinalizată).
// Se pierde la restart, ca tot restul stării din API — persistența o va înlocui.

// key = `${cityId}:${vehicleId}` -> orderId
const orderByVehicle = new Map<string, string>();

// orderId -> key
const vehicleByOrder = new Map<string, string>();

function keyOf(cityId: string, vehicleId: string): string {
  return `${cityId}:${vehicleId}`;
}

// ==============================
// Public API
// ==============================
export function markVehicleBusy(
  cityId: string,
  vehicleId: string,
  orderId: string,
): void {
  const key = keyOf(cityId, vehicleId);
  orderByVehicle.set(key, orderId);
  vehicleByOrder.set(orderId, key);
}

export function isVehicleBusy(cityId: string, vehicleId: string): boolean {
  return orderByVehicle.has(keyOf(cityId, vehicleId));
}

// Eliberează vehiculul comenzii (la COMPLETED / CANCELED). Întoarce false dacă comanda nu era cunoscută.
export function releaseVehicleOfOrder(orderId: string): boolean {
  const key = vehicleByOrder.get(orderId);
  if (key === undefined) return false;

  vehicleByOrder.delete(orderId);
  // nu eliberăm vehiculul dacă între timp a primit altă comandă
  if (orderByVehicle.get(key) === orderId) orderByVehicle.delete(key);
  return true;
}

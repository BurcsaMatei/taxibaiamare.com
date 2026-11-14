// controlcenter/components/ops/map/opsMap.types.ts

// ==============================
// Imports
// ==============================
import type { CityPublic, OrderStatus } from "@taxi/shared";
import type { Feature, FeatureCollection, Point } from "geojson";
import type { IControl, Map as MapboxMap } from "mapbox-gl";

// ==============================
// Types
// ==============================
export type FleetVehicle = {
  vehicleId: string; // indicativ (ex: "01")
  indicativLabel: string; // ex: "INDICATIV 01"
  plateNumber: string; // ex: "MM01ABC"
  driverName: string; // ex: "IACOB MARIUS"
  carModel: string; // ex: "RENAULT MEGANE"
  carImagePath: string; // path (frontend asset)
  driverImagePath: string; // path (frontend asset)
};

export type FleetResponse = {
  ok: true;
  cityId: string;
  total: number;
  vehicles: ReadonlyArray<FleetVehicle>;
};

export type CityResponseOk = {
  ok: true;
  city: CityPublic;
};

export type VehiclePoint = {
  vehicleId: string;
  lng: number;
  lat: number;
  ts: string; // ISO
};

export type VehiclePresence = {
  vehicleId: string;
  online: boolean;
  ts: string; // ISO
};

export type OrderAssigned = {
  orderId: string;
  vehicleId: string;
  ts: string; // ISO
};

export type OrderStatusSnap = {
  orderId: string;
  status: OrderStatus;
  ts: string; // ISO
};

export type DriverUiStatus = "OFFLINE" | "ONLINE" | "BUSY";

export type VehicleFeatureProps = {
  vehicleId: string;
  ts: string;
  busy: boolean;
};

export type VehicleFeature = Feature<Point, VehicleFeatureProps>;
export type VehicleFeatureCollection = FeatureCollection<Point, VehicleFeatureProps>;

// Minimal runtime shape for dynamic import (avoid import() type annotations)
export type MapboxModule = {
  default: {
    accessToken: string;

    Map: new (opts: {
      container: HTMLElement;
      style: string;
      center: [number, number];
      zoom: number;
    }) => MapboxMap;

    NavigationControl: new (opts?: { visualizePitch?: boolean }) => IControl;
  };
};

export type ThemeMode = "light" | "dark";

export type LayerClickEvent = {
  features?: Array<{
    properties?: unknown;
  }>;
};

// api/src/modules/orders/index.ts

// ==============================
// Imports
// ==============================
import type { Express } from "express";
import crypto from "node:crypto";
import {
  isFinalOrderStatus,
  makeOrderAssignedEnvelope,
  makeOrderCreatedEnvelope,
  makeOrderDispatchFailedEnvelope,
  makeOrderStatusChangedEnvelope,
  makeOrderUserCalledDispatchEnvelope,
  normalizeOrderStatus,
  topics,
} from "@taxi/shared";
import type {
  CallOrderRequest,
  CallOrderResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  GeoPoint,
  OrderCallSource,
  OrderCallTarget,
  OrderStatus,
  PatchOrderStatusRequest,
  PatchOrderStatusResponse,
  ServiceTypeCode,
} from "@taxi/shared";

import type { RealtimeHub } from "../realtime/wsServer.js";
import { publishStrict } from "../realtime/index.js";
import { markVehicleBusy, releaseVehicleOfOrder } from "../dispatch/busyVehicles.js";
import { chooseNearestVehicle } from "../dispatch/index.js";

// ==============================
// Utils
// ==============================
function isGeoPoint(v: unknown): v is GeoPoint {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as { lat?: unknown }).lat === "number" &&
    typeof (v as { lng?: unknown }).lng === "number"
  );
}

function normalizeService(v: unknown): ServiceTypeCode | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toUpperCase();
  if (s === "TAXI" || s === "DELIVERY" || s === "ROADSIDE") return s;
  return null;
}

function normalizeCallTarget(v: unknown): OrderCallTarget | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toUpperCase();
  return s === "DISPATCH" ? "DISPATCH" : null;
}

function normalizeCallSource(v: unknown): OrderCallSource {
  if (typeof v !== "string") return "USER_APP";
  const s = v.trim().toUpperCase();
  if (s === "USER_APP" || s === "DRIVER_APP" || s === "CONTROL_CENTER") return s;
  return "USER_APP";
}

function normalizePhone(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const raw = v.trim();
  if (!raw) return null;

  // păstrăm doar cifre și un + leading (dacă există)
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  // evităm "++++"
  const plusCount = (cleaned.match(/\+/g) || []).length;
  if (plusCount > 1) return null;
  if (plusCount === 1 && !cleaned.startsWith("+")) return null;

  return cleaned;
}

// ==============================
// Module
// ==============================
export function registerOrdersModule(app: Express, hub: RealtimeHub): void {
  app.post("/orders", (req, res) => {
    const body = req.body as unknown;

    if (!body || typeof body !== "object") {
      res.status(400).json({ ok: false, error: "Invalid body" });
      return;
    }

    const b = body as Partial<CreateOrderRequest>;

    if (typeof b.cityId !== "string" || b.cityId.trim().length === 0) {
      res.status(400).json({ ok: false, error: "cityId required" });
      return;
    }

    const service = normalizeService(b.service);
    if (!service) {
      res.status(400).json({ ok: false, error: "invalid service" });
      return;
    }

    if (!isGeoPoint(b.pickup) || !isGeoPoint(b.dropoff)) {
      res.status(400).json({ ok: false, error: "pickup/dropoff invalid" });
      return;
    }

    const cityId = b.cityId.trim();
    const orderId = crypto.randomUUID();

    // ✅ default: NEW
    const createdStatus: OrderStatus = "NEW";

    const nearest = chooseNearestVehicle({
      cityId,
      pickup: b.pickup,
    });

    const assignedVehicleId = nearest ? nearest.vehicleId : null;

    // 1) emit order.created (NEW)
    const envCreated = makeOrderCreatedEnvelope({
      orderId,
      cityId,
      service,
      status: createdStatus,
      pickup: b.pickup,
      dropoff: b.dropoff,
    });

    publishStrict(hub, topics.controlcenter(cityId), envCreated);
    publishStrict(hub, topics.city(cityId), envCreated);

    // 2a) dacă NU avem alocare: emit order.dispatchFailed (controlcenter + order)
    if (!assignedVehicleId) {
      const envFailed = makeOrderDispatchFailedEnvelope({
        orderId,
        cityId,
        service,
        reason: "NO_AVAILABLE_VEHICLE",
      });

      publishStrict(hub, topics.controlcenter(cityId), envFailed);
      publishStrict(hub, topics.order(orderId), envFailed);

      const payload: CreateOrderResponse = {
        ok: true,
        orderId,
        status: "NEW",
        assignedVehicleId: null,
        dispatch: "FAILED",
        reason: "NO_AVAILABLE_VEHICLE",
      };
      res.status(201).json(payload);
      return;
    }

    // 2b) dacă avem alocare: vehiculul devine ocupat, apoi emit order.assigned + order.statusChanged NEW->ASSIGNED
    markVehicleBusy(cityId, assignedVehicleId, orderId);

    const envAssigned = makeOrderAssignedEnvelope({
      orderId,
      cityId,
      service,
      vehicleId: assignedVehicleId,
      distanceMeters: nearest?.distanceMeters,
    });

    publishStrict(hub, topics.controlcenter(cityId), envAssigned);
    publishStrict(hub, topics.order(orderId), envAssigned);

    const envStatus = makeOrderStatusChangedEnvelope({
      orderId,
      cityId,
      service,
      fromStatus: "NEW",
      toStatus: "ASSIGNED",
    });

    publishStrict(hub, topics.controlcenter(cityId), envStatus);
    publishStrict(hub, topics.order(orderId), envStatus);

    const payload: CreateOrderResponse = {
      ok: true,
      orderId,
      status: "ASSIGNED",
      assignedVehicleId,
      dispatch: "OK",
    };
    res.status(201).json(payload);
  });

  // ✅ call intent: user apasă “Sună dispecerat”
  // Statless: doar publish realtime -> controlcenter + order
  app.post("/orders/:id/call", (req, res) => {
    const orderId = String(req.params.id || "").trim();
    if (orderId.length === 0) {
      res.status(400).json({ ok: false, error: "orderId required" });
      return;
    }

    const body = req.body as unknown;
    if (!body || typeof body !== "object") {
      res.status(400).json({ ok: false, error: "Invalid body" });
      return;
    }

    const b = body as Partial<CallOrderRequest>;

    if (typeof b.cityId !== "string" || b.cityId.trim().length === 0) {
      res.status(400).json({ ok: false, error: "cityId required" });
      return;
    }

    const service = normalizeService(b.service);
    if (!service) {
      res.status(400).json({ ok: false, error: "invalid service" });
      return;
    }

    const target = normalizeCallTarget(b.target);
    if (!target) {
      res.status(400).json({ ok: false, error: "invalid target" });
      return;
    }

    const phone = normalizePhone(b.phoneNumber);
    if (!phone) {
      res.status(400).json({ ok: false, error: "invalid phoneNumber" });
      return;
    }

    const cityId = b.cityId.trim();
    const source = normalizeCallSource(b.source);

    const env = makeOrderUserCalledDispatchEnvelope({
      orderId,
      cityId,
      service,
      target,
      phoneNumber: phone,
      source,
    });

    publishStrict(hub, topics.controlcenter(cityId), env);
    publishStrict(hub, topics.order(orderId), env);

    const payload: CallOrderResponse = { ok: true };
    res.status(200).json(payload);
  });

  app.patch("/orders/:id/status", (req, res) => {
    const orderId = String(req.params.id || "").trim();
    if (orderId.length === 0) {
      res.status(400).json({ ok: false, error: "orderId required" });
      return;
    }

    const body = req.body as unknown;
    if (!body || typeof body !== "object") {
      res.status(400).json({ ok: false, error: "Invalid body" });
      return;
    }

    const b = body as Partial<PatchOrderStatusRequest>;

    if (typeof b.cityId !== "string" || b.cityId.trim().length === 0) {
      res.status(400).json({ ok: false, error: "cityId required" });
      return;
    }

    const from = normalizeOrderStatus(b.from);
    const to = normalizeOrderStatus(b.to);

    if (!from || !to) {
      res.status(400).json({ ok: false, error: "from/to required" });
      return;
    }

    const service = normalizeService(b.service ?? "TAXI");
    if (!service) {
      res.status(400).json({ ok: false, error: "invalid service" });
      return;
    }

    const cityId = b.cityId.trim();

    // comandă încheiată -> vehiculul ei se eliberează
    if (isFinalOrderStatus(to)) releaseVehicleOfOrder(orderId);

    const env = makeOrderStatusChangedEnvelope({
      orderId,
      cityId,
      service,
      fromStatus: from,
      toStatus: to,
    });

    publishStrict(hub, topics.controlcenter(cityId), env);
    publishStrict(hub, topics.order(orderId), env);

    const payload: PatchOrderStatusResponse = { ok: true, orderId, from, to };
    res.status(200).json(payload);
  });
}
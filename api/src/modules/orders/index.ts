// api/src/modules/orders/index.ts

// ==============================
// Imports
// ==============================
import type { Express } from "express";
import crypto from "node:crypto";
import {
  LIST_ORDERS_DEFAULT_LIMIT,
  LIST_ORDERS_MAX_LIMIT,
  canTransitionOrderStatus,
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
  GetOrderResponse,
  ListOrdersResponse,
  OrderCallSource,
  OrderCallTarget,
  OrderStatus,
  PatchOrderStatusRequest,
  PatchOrderStatusResponse,
  ServiceTypeCode,
} from "@taxi/shared";

import type { RealtimeHub } from "../realtime/wsServer.js";
import { publishStrict } from "../realtime/index.js";
import { getPool } from "../../db/pool.js";
import { chooseNearestVehicle } from "../dispatch/index.js";
import {
  getOrderById,
  insertOrder,
  isOrderId,
  isUniqueViolation,
  listBusyVehicleIds,
  listOrders,
  transitionOrderStatus,
  type OrderListFilter,
  type TransitionResult,
} from "./repository.js";

// ==============================
// Constants
// ==============================
// De câte ori încercăm următorul vehicul când altă comandă l-a luat între timp (vezi migrația 002).
const MAX_ASSIGN_ATTEMPTS = 5;

// ==============================
// Utils
// ==============================
function logDbError(where: string, e: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[orders] ${where}: ${e instanceof Error ? e.message : String(e)}`);
}

// Un instant ISO 8601 CU fus orar (Z sau ±hh:mm). Fără fus, ora ar depinde de serverul care o citește.
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function parseInstant(v: unknown): Date | null {
  if (typeof v !== "string") return null;

  // Într-un URL, un `+` necodat ajunge ca spațiu („…T20:00:00 03:00"): îl reparăm.
  const s = v.trim().replace(/ (\d{2}:\d{2})$/, "+$1");
  if (!ISO_WITH_OFFSET.test(s)) return null;

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

type ListQueryResult = { ok: true; filter: OrderListFilter } | { ok: false; error: string };

// Parametrii pentru GET /orders (vezi contracts/orders.ts). Guard-uri scrise de mână, fără bibliotecă de validare.
function parseListQuery(query: Record<string, unknown>): ListQueryResult {
  const cityId = typeof query.cityId === "string" ? query.cityId.trim() : "";
  if (!cityId) return { ok: false, error: "cityId required" };

  const filter: OrderListFilter = { cityId, limit: LIST_ORDERS_DEFAULT_LIMIT };

  if (query.status !== undefined) {
    const raw = Array.isArray(query.status) ? query.status : [query.status];
    const statuses: OrderStatus[] = [];

    for (const item of raw) {
      if (typeof item !== "string") return { ok: false, error: "invalid status" };

      for (const part of item.split(",")) {
        const text = part.trim();
        if (text.length === 0) continue;

        const status = normalizeOrderStatus(text);
        if (!status) return { ok: false, error: `invalid status: ${text}` };
        statuses.push(status);
      }
    }

    if (statuses.length > 0) filter.statuses = statuses;
  }

  if (query.vehicleId !== undefined) {
    if (typeof query.vehicleId !== "string") return { ok: false, error: "invalid vehicleId" };
    const vehicleId = query.vehicleId.trim();
    if (vehicleId.length > 0) filter.vehicleId = vehicleId;
  }

  const timeError = (name: string): string =>
    `${name} must be ISO 8601 with timezone, e.g. 2026-10-28T20:00:00+03:00 (encode + as %2B in a URL)`;

  if (typeof query.from === "string" && query.from.trim().length > 0) {
    const from = parseInstant(query.from);
    if (!from) return { ok: false, error: timeError("from") };
    filter.from = from;
  } else if (query.from !== undefined && typeof query.from !== "string") {
    return { ok: false, error: timeError("from") };
  }

  if (typeof query.to === "string" && query.to.trim().length > 0) {
    const to = parseInstant(query.to);
    if (!to) return { ok: false, error: timeError("to") };
    filter.to = to;
  } else if (query.to !== undefined && typeof query.to !== "string") {
    return { ok: false, error: timeError("to") };
  }

  if (filter.from && filter.to && filter.from.getTime() >= filter.to.getTime()) {
    return { ok: false, error: "from must be before to" };
  }

  if (query.limit !== undefined) {
    const text = typeof query.limit === "string" ? query.limit.trim() : "";
    if (!/^\d+$/.test(text) || Number.parseInt(text, 10) < 1) {
      return { ok: false, error: "limit must be a positive integer" };
    }
    filter.limit = Math.min(Number.parseInt(text, 10), LIST_ORDERS_MAX_LIMIT);
  }

  return { ok: true, filter };
}

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
  // ✅ citire: comenzile unui oraș, cele mai noi primele, cu filtre (status, vehicul, perioadă) — vezi
  // contracts/orders.ts. Pentru căutări: perioada + indicativul vehiculului.
  app.get("/orders", async (req, res) => {
    const parsed = parseListQuery(req.query);
    if (!parsed.ok) {
      res.status(400).json({ ok: false, error: parsed.error });
      return;
    }

    const pool = getPool();
    if (!pool) {
      res.status(503).json({ ok: false, error: "database not configured" });
      return;
    }

    try {
      const { orders, hasMore } = await listOrders(pool, parsed.filter);
      const payload: ListOrdersResponse = { ok: true, orders, hasMore };
      res.status(200).json(payload);
    } catch (e) {
      logDbError("GET /orders", e);
      res.status(503).json({ ok: false, error: "database unavailable" });
    }
  });

  app.get("/orders/:id", async (req, res) => {
    const orderId = String(req.params.id || "").trim();

    // Un id care nu e uuid nu poate exista în bază.
    if (!isOrderId(orderId)) {
      res.status(404).json({ ok: false, error: "order not found" });
      return;
    }

    const pool = getPool();
    if (!pool) {
      res.status(503).json({ ok: false, error: "database not configured" });
      return;
    }

    try {
      const order = await getOrderById(pool, orderId);
      if (!order) {
        res.status(404).json({ ok: false, error: "order not found" });
        return;
      }

      const payload: GetOrderResponse = { ok: true, order };
      res.status(200).json(payload);
    } catch (e) {
      logDbError("GET /orders/:id", e);
      res.status(503).json({ ok: false, error: "database unavailable" });
    }
  });

  app.post("/orders", async (req, res) => {
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
    const pickup = b.pickup;
    const dropoff = b.dropoff;

    // ✅ default: NEW
    const createdStatus: OrderStatus = "NEW";

    const pool = getPool();
    if (!pool) {
      res.status(503).json({ ok: false, error: "database not configured" });
      return;
    }

    // Salvăm ÎNAINTE să publicăm: ce vede controlcenter-ul live există întotdeauna în bază.
    // Baza decide ce vehicule sunt ocupate. Dacă două comenzi simultane aleg același vehicul, indexul
    // unic (migrația 002) o respinge pe a doua, iar noi încercăm următorul vehicul.
    let nearest: { vehicleId: string; distanceMeters: number } | null = null;

    try {
      const busyVehicleIds = await listBusyVehicleIds(pool, cityId);

      for (let attempt = 0; attempt < MAX_ASSIGN_ATTEMPTS; attempt += 1) {
        const candidate = chooseNearestVehicle({ cityId, pickup, busyVehicleIds });
        if (!candidate) break;

        try {
          await insertOrder(pool, {
            id: orderId,
            cityId,
            service,
            status: "ASSIGNED",
            pickup,
            dropoff,
            assignedVehicleId: candidate.vehicleId,
            dispatchFailedReason: null,
          });
          nearest = candidate;
          break;
        } catch (e) {
          if (!isUniqueViolation(e)) throw e;
          busyVehicleIds.add(candidate.vehicleId);
        }
      }

      if (!nearest) {
        await insertOrder(pool, {
          id: orderId,
          cityId,
          service,
          status: "NEW",
          pickup,
          dropoff,
          assignedVehicleId: null,
          dispatchFailedReason: "NO_AVAILABLE_VEHICLE",
        });
      }
    } catch (e) {
      logDbError("POST /orders", e);
      res.status(503).json({ ok: false, error: "database unavailable" });
      return;
    }

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

    // 2b) dacă avem alocare (vehiculul e deja ocupat în bază): emit order.assigned + order.statusChanged NEW->ASSIGNED
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

  app.patch("/orders/:id/status", async (req, res) => {
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

    // `service` din cerere rămâne opțional; dacă e trimis, trebuie să fie valid. Folosim serviciul salvat în bază.
    if (b.service !== undefined && !normalizeService(b.service)) {
      res.status(400).json({ ok: false, error: "invalid service" });
      return;
    }

    const cityId = b.cityId.trim();

    // Schimbările imposibile (ex. din COMPLETED) se resping fără să atingem baza.
    if (!canTransitionOrderStatus(from, to)) {
      res.status(400).json({ ok: false, error: `transition not allowed: ${from} -> ${to}` });
      return;
    }

    // Un id care nu e uuid nu poate exista în bază.
    if (!isOrderId(orderId)) {
      res.status(404).json({ ok: false, error: "order not found" });
      return;
    }

    const pool = getPool();
    if (!pool) {
      res.status(503).json({ ok: false, error: "database not configured" });
      return;
    }

    let result: TransitionResult;
    try {
      result = await transitionOrderStatus(pool, { orderId, cityId, from, to });
    } catch (e) {
      logDbError("PATCH /orders/:id/status", e);
      res.status(503).json({ ok: false, error: "database unavailable" });
      return;
    }

    if (result.kind === "not_found") {
      res.status(404).json({ ok: false, error: "order not found" });
      return;
    }

    if (result.kind === "conflict") {
      res
        .status(409)
        .json({ ok: false, error: `order status is ${result.actualStatus}, expected ${from}` });
      return;
    }

    // Vehiculul unei comenzi încheiate se eliberează singur: „ocupat" = are o comandă activă în bază.
    const service = normalizeService(result.service);
    if (!service) {
      res.status(500).json({ ok: false, error: "invalid stored service" });
      return;
    }

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

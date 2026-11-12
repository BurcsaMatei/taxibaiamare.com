// controlcenter/components/ops/map/OpsMapPage.tsx

// ==============================
// Imports
// ==============================
import type { OrderStatus, RealtimeEnvelope } from "@taxi/shared";
import { isActiveOrderStatus, topics } from "@taxi/shared";
import * as React from "react";

import {
  decodeControlcenterTokenPayloadUnsafe,
  getStoredControlcenterToken,
  isControlcenterTokenExpired,
} from "../../../lib/auth/controlcenterAuth";
import { useControlcenterTopicEvents } from "../../../lib/realtime/controlcenterWs";
import * as s from "../../../styles/ops/opsMap.css";
import OpsLoginGate from "../auth/OpsLoginGate";
import OpsCitySwitcher from "../cities/OpsCitySwitcher";
import OpsCornerPanel from "./OpsCornerPanel";
import OpsHud from "./OpsHud";
import type {
  DriverUiStatus,
  FleetVehicle,
  OrderAssigned,
  OrderStatusSnap,
  VehiclePoint,
  VehiclePresence,
} from "./opsMap.types";
import {
  fetchCity,
  fetchFleetDirectory,
  fmtAge,
  fmtIsoLocal,
  getOrderAssigned,
  getOrderStatusSnap,
  getVehiclePoint,
  getVehiclePresence,
  normalizeIndicativInput,
  ONLINE_TTL_MS,
  parseIsoMs,
  toTelHref,
  useNowTick,
  useThemeMode,
} from "./opsMap.utils";
import type { OpsMapCanvasHandle, OpsMapCanvasStatus, OpsMapView } from "./OpsMapCanvas";
import OpsMapCanvas from "./OpsMapCanvas";

// ==============================
// Constante
// ==============================
const EMPTY_EVENTS: ReadonlyArray<RealtimeEnvelope> = [];

// fallback safe (only if city fetch fails)
const FALLBACK_VIEW: OpsMapView = {
  center: [23.584, 47.659] as const,
  zoom: 13,
};

// ==============================
// Types
// ==============================
export type OpsMapPageProps = {
  cityId: string;
};

// ==============================
// Component
// ==============================
export default function OpsMapPage(props: OpsMapPageProps): React.JSX.Element {
  const cityId = props.cityId;

  // ==============================
  // Auth
  // ==============================
  const [token, setToken] = React.useState<string | null>(null);
  const [payloadScope, setPayloadScope] = React.useState<"hq" | "city" | null>(null);
  const [payloadCityId, setPayloadCityId] = React.useState<string | null>(null);
  const [tokenExpired, setTokenExpired] = React.useState<boolean>(false);

  React.useEffect(() => {
    const t2 = getStoredControlcenterToken();
    setToken(t2);

    if (!t2) {
      setPayloadScope(null);
      setPayloadCityId(null);
      setTokenExpired(false);
      return;
    }

    const payload = decodeControlcenterTokenPayloadUnsafe(t2);
    if (!payload) {
      setPayloadScope(null);
      setPayloadCityId(null);
      setTokenExpired(true);
      return;
    }

    setPayloadScope(payload.scope);
    setPayloadCityId(typeof payload.cityId === "string" ? payload.cityId : null);
    setTokenExpired(isControlcenterTokenExpired(payload));
  }, []);

  const isHq = payloadScope === "hq";
  const mismatch = payloadScope === "city" && payloadCityId ? payloadCityId !== cityId : false;
  const wsEnabled = !!token && !tokenExpired && !mismatch;

  // ==============================
  // WS (hook always called)
  // ==============================
  const topic = topics.controlcenter(cityId);
  const ws = useControlcenterTopicEvents(topic, {
    enabled: wsEnabled,
    ...(token ? { authToken: token } : {}),
  });

  const connected = wsEnabled ? ws.connected : false;
  const ready = wsEnabled ? ws.ready : false;
  const lastError = wsEnabled ? ws.lastError : null;
  const eventsSafe = wsEnabled ? ws.events : EMPTY_EVENTS;

  // ==============================
  // Time + theme
  // ==============================
  const now = useNowTick(1000);
  const themeMode = useThemeMode();

  // ==============================
  // Data fetch
  // ==============================
  const [fleet, setFleet] = React.useState<ReadonlyArray<FleetVehicle>>([]);
  const [fleetTotal, setFleetTotal] = React.useState<number>(0);
  const [fleetError, setFleetError] = React.useState<string | null>(null);

  const [dispatchPhone, setDispatchPhone] = React.useState<string | null>(null);
  const [cityError, setCityError] = React.useState<string | null>(null);

  const [view, setView] = React.useState<OpsMapView>(FALLBACK_VIEW);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const r = await fetchFleetDirectory(cityId);
        if (!alive) return;

        setFleet(r.vehicles);
        setFleetTotal(Number.isFinite(r.total) ? r.total : 0);
        setFleetError(null);
      } catch (err) {
        if (!alive) return;
        const msg = err instanceof Error ? err.message : "Failed to load fleet directory";
        setFleet([]);
        setFleetTotal(0);
        setFleetError(msg);
      }
    })();

    return () => {
      alive = false;
    };
  }, [cityId]);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!token) return;

        const c = await fetchCity(cityId, token);
        if (!alive) return;

        setDispatchPhone(c.dispatchPhone ?? null);
        setCityError(null);

        // ✅ map view per city (single source of truth from API)
        const center = c.mapCenter;
        const zoom = c.mapZoom;

        if (
          center &&
          typeof center === "object" &&
          typeof center.lng === "number" &&
          Number.isFinite(center.lng) &&
          typeof center.lat === "number" &&
          Number.isFinite(center.lat) &&
          typeof zoom === "number" &&
          Number.isFinite(zoom)
        ) {
          setView({ center: [center.lng, center.lat] as const, zoom });
        } else {
          // keep fallback view
        }
      } catch (err) {
        if (!alive) return;
        const msg = err instanceof Error ? err.message : "Failed to load city info";
        setDispatchPhone(null);
        setCityError(msg);
        // keep fallback view
      }
    })();

    return () => {
      alive = false;
    };
  }, [cityId, token]);

  const dispatchHref = dispatchPhone ? toTelHref(dispatchPhone) : "";

  const fleetById = React.useMemo(() => {
    const m = new globalThis.Map<string, FleetVehicle>();
    for (const v of fleet) m.set(v.vehicleId, v);
    return m;
  }, [fleet]);

  // ==============================
  // Realtime derived maps
  // ==============================
  const latestPresenceById = React.useMemo(() => {
    const byId = new globalThis.Map<string, VehiclePresence>();

    for (const e of eventsSafe) {
      const vp = getVehiclePresence(e);
      if (!vp) continue;

      const prev = byId.get(vp.vehicleId);
      if (!prev || parseIsoMs(vp.ts) >= parseIsoMs(prev.ts)) byId.set(vp.vehicleId, vp);
    }

    return byId;
  }, [eventsSafe]);

  const latestPointById = React.useMemo(() => {
    const byId = new globalThis.Map<string, VehiclePoint>();

    for (const e of eventsSafe) {
      const p = getVehiclePoint(e);
      if (!p) continue;

      const prev = byId.get(p.vehicleId);
      if (!prev || parseIsoMs(p.ts) >= parseIsoMs(prev.ts)) byId.set(p.vehicleId, p);
    }

    return byId;
  }, [eventsSafe]);

  const latestAssignedByOrderId = React.useMemo(() => {
    const byOrder = new globalThis.Map<string, OrderAssigned>();

    for (const e of eventsSafe) {
      const a = getOrderAssigned(e);
      if (!a) continue;

      const prev = byOrder.get(a.orderId);
      if (!prev || parseIsoMs(a.ts) >= parseIsoMs(prev.ts)) byOrder.set(a.orderId, a);
    }

    return byOrder;
  }, [eventsSafe]);

  const latestStatusByOrderId = React.useMemo(() => {
    const byOrder = new globalThis.Map<string, OrderStatusSnap>();

    for (const e of eventsSafe) {
      const snap = getOrderStatusSnap(e);
      if (!snap) continue;

      const prev = byOrder.get(snap.orderId);
      if (!prev || parseIsoMs(snap.ts) >= parseIsoMs(prev.ts)) byOrder.set(snap.orderId, snap);
    }

    return byOrder;
  }, [eventsSafe]);

  const vehiclesOnline = React.useMemo(() => {
    const out: VehiclePoint[] = [];

    for (const [vehicleId2, p] of latestPointById.entries()) {
      const pMs = parseIsoMs(p.ts);
      if (now - pMs > ONLINE_TTL_MS) continue;

      const pres = latestPresenceById.get(vehicleId2);
      if (pres) {
        const presMs = parseIsoMs(pres.ts);
        if (pres.online === false && now - presMs <= ONLINE_TTL_MS) continue;
      }

      out.push(p);
    }

    return out;
  }, [latestPointById, latestPresenceById, now]);

  const vehiclesForSearch = React.useMemo(
    () => Array.from(latestPointById.values()),
    [latestPointById],
  );

  const onlineCount = vehiclesOnline.length;
  const total = fleetTotal > 0 ? fleetTotal : 0;
  const offlineCount = total > 0 ? Math.max(0, total - onlineCount) : 0;

  // ==============================
  // Selection + computed status
  // ==============================
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<string | null>(null);

  const selectedVehicle = selectedVehicleId ? (fleetById.get(selectedVehicleId) ?? null) : null;

  const selectedDriverStatus: DriverUiStatus = React.useMemo(() => {
    if (!selectedVehicleId) return "OFFLINE";

    const p = latestPointById.get(selectedVehicleId);
    const pres = latestPresenceById.get(selectedVehicleId);

    const pMs = p ? parseIsoMs(p.ts) : 0;
    const presMs = pres ? parseIsoMs(pres.ts) : 0;

    const hasRecentPoint = !!p && now - pMs <= ONLINE_TTL_MS;
    const hasRecentOffline = !!pres && pres.online === false && now - presMs <= ONLINE_TTL_MS;

    if (!hasRecentPoint || hasRecentOffline) return "OFFLINE";

    for (const a of latestAssignedByOrderId.values()) {
      if (a.vehicleId !== selectedVehicleId) continue;

      const st = latestStatusByOrderId.get(a.orderId);
      const status: OrderStatus = st?.status ?? "ASSIGNED";
      if (isActiveOrderStatus(status)) return "BUSY";
    }

    return "ONLINE";
  }, [
    latestAssignedByOrderId,
    latestPointById,
    latestPresenceById,
    latestStatusByOrderId,
    now,
    selectedVehicleId,
  ]);

  // ==============================
  // Map controls
  // ==============================
  const [searchValue, setSearchValue] = React.useState<string>("");
  const [searchHint, setSearchHint] = React.useState<string>("");

  const mapRef = React.useRef<OpsMapCanvasHandle | null>(null);

  const [mapStatus, setMapStatus] = React.useState<OpsMapCanvasStatus>({ ok: false, error: null });

  const computeOnlineStatusForVehicle = React.useCallback(
    (vehicleId2: string): { online: boolean; lastSeenIso: string } | null => {
      const p = latestPointById.get(vehicleId2);
      if (!p) return null;

      const pres = latestPresenceById.get(vehicleId2);

      const pMs = parseIsoMs(p.ts);
      const presMs = pres ? parseIsoMs(pres.ts) : 0;

      const hasRecentPoint = now - pMs <= ONLINE_TTL_MS;
      const hasRecentOffline = !!pres && pres.online === false && now - presMs <= ONLINE_TTL_MS;

      return { online: hasRecentPoint && !hasRecentOffline, lastSeenIso: p.ts };
    },
    [latestPointById, latestPresenceById, now],
  );

  const onSubmitSearch = React.useCallback(
    (ev: React.FormEvent) => {
      ev.preventDefault();

      const normalized = normalizeIndicativInput(searchValue);
      if (!normalized) {
        setSearchHint("Introduce indicativ (ex: 05).");
        return;
      }

      const candidates = [normalized, normalized.replace(/^0+/, "")].filter(Boolean);

      let focusedId: string | null = null;
      for (const cand of candidates) {
        const ok = mapRef.current?.focusVehicle(cand) ?? false;
        if (ok) {
          focusedId = cand;
          break;
        }
      }

      if (!focusedId) {
        setSearchHint(`Indicativ negăsit: ${normalized} (nu există locație în stream)`);
        return;
      }

      const snap = computeOnlineStatusForVehicle(focusedId);
      if (!snap) {
        setSearchHint(`Indicativ găsit: ${focusedId} — fără lastSeen (unexpected)`);
        return;
      }

      const lastSeen = fmtIsoLocal(snap.lastSeenIso);
      const age = fmtAge(now, snap.lastSeenIso);

      setSearchHint(
        snap.online
          ? `Indicativ ${focusedId}: ONLINE · last seen ${age} ago (${lastSeen})`
          : `Indicativ ${focusedId}: OFFLINE · last seen ${age} ago (${lastSeen})`,
      );
    },
    [computeOnlineStatusForVehicle, now, searchValue],
  );

  const onReset = React.useCallback(() => {
    mapRef.current?.resetView();
    setSearchHint("");
  }, []);

  // ==============================
  // HUD / Corner collapse
  // ==============================
  const [hudCollapsed, setHudCollapsed] = React.useState<boolean>(false);
  const [cornerCollapsed, setCornerCollapsed] = React.useState<boolean>(false);

  const toggleHud = React.useCallback(() => setHudCollapsed((v) => !v), []);
  const toggleCorner = React.useCallback(() => setCornerCollapsed((v) => !v), []);

  // ==============================
  // Render (after hooks)
  // ==============================
  if (!wsEnabled) {
    return <OpsLoginGate title="CONTROL CENTER / MAP" />;
  }

  return (
    <main className={s.page} data-page="ops-map">
      <div
        className={s.mapRoot}
        aria-label="Map canvas"
        data-hud-collapsed={hudCollapsed ? "1" : "0"}
      >
        <div className={s.mapFill} aria-hidden="true" />

        <OpsMapCanvas
          ref={mapRef}
          view={view}
          vehiclesForRender={vehiclesOnline}
          vehiclesForSearch={vehiclesForSearch}
          themeMode={themeMode}
          onSelectVehicleId={(id) => setSelectedVehicleId(id)}
          onStatusChange={setMapStatus}
        />

        <div className={s.mapTopRight} aria-label="Map controls">
          <button className={s.mapBtn} type="button" onClick={onReset}>
            Reset map
          </button>
        </div>

        {isHq && token ? (
          <div className={s.mapTopHud} aria-label="HQ city selector">
            <OpsCitySwitcher authToken={token} currentCityId={cityId} mode="map" />
          </div>
        ) : null}

        <OpsHud
          hudCollapsed={hudCollapsed}
          onToggleHud={toggleHud}
          themeMode={themeMode}
          connected={connected}
          ready={ready}
          lastError={lastError}
          cityId={cityId}
          dispatchPhone={dispatchPhone}
          dispatchHref={dispatchHref}
          topic={topic}
          onlineCount={onlineCount}
          offlineCount={offlineCount}
          mapOk={mapStatus.ok}
          mapError={mapStatus.error}
          fleetError={fleetError}
          cityError={cityError}
          eventsCount={eventsSafe.length}
          lastPointsCount={latestPointById.size}
          lastPresenceCount={latestPresenceById.size}
          fleetCount={fleet.length}
        />

        <OpsCornerPanel
          cornerCollapsed={cornerCollapsed}
          onToggleCorner={toggleCorner}
          searchValue={searchValue}
          onChangeSearchValue={setSearchValue}
          onSubmitSearch={onSubmitSearch}
          searchHint={searchHint}
          selectedVehicle={selectedVehicle}
          selectedDriverStatus={selectedDriverStatus}
        />
      </div>
    </main>
  );
}

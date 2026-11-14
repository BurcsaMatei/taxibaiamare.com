// controlcenter/components/ops/map/OpsMapCanvas.tsx

// ==============================
// Imports
// ==============================
import type { GeoJSONSource, IControl, Map as MapboxMap } from "mapbox-gl";
import * as React from "react";

import * as s from "../../../styles/ops/opsMap.css";
import type {
  LayerClickEvent,
  MapboxModule,
  ThemeMode,
  VehicleFeature,
  VehicleFeatureCollection,
  VehiclePoint,
} from "./opsMap.types";

// ==============================
// Constante
// ==============================
// focus default (safe)
const FOCUS_ZOOM = 15.5;

// icon local (public/)
const TAXI_ICON_SRC = "/images/taxi/taxi.png";
const TAXI_ICON_ID = "taxi-icon";
const TAXI_BUSY_ICON_SRC = "/images/taxi/taxi-busy.png"; // mașină cu comandă activă (roșie)
const TAXI_BUSY_ICON_ID = "taxi-busy-icon";

const SOURCE_ID = "vehicles-source";
const LAYER_ID = "vehicles-layer";

// Mapbox styles (theme-aware)
const MAP_STYLE_LIGHT = "mapbox://styles/mapbox/streets-v12";
const MAP_STYLE_DARK = "mapbox://styles/mapbox/dark-v11";

// ==============================
// Types
// ==============================
export type OpsMapCanvasStatus = {
  ok: boolean;
  error: string | null;
};

export type OpsMapCanvasHandle = {
  focusVehicle: (vehicleId: string) => boolean;
  resetView: () => void;
};

export type OpsMapView = {
  center: readonly [number, number]; // [lng, lat]
  zoom: number;
};

export type OpsMapCanvasProps = {
  view: OpsMapView; // ✅ per-city view (no hardcoding here)
  vehiclesForRender: ReadonlyArray<VehiclePoint>;
  vehiclesForSearch: ReadonlyArray<VehiclePoint>;
  busyVehicleIds: ReadonlySet<string>; // vehicule cu comandă activă -> marker roșu
  themeMode: ThemeMode;
  onSelectVehicleId: (vehicleId: string) => void;
  onStatusChange: (st: OpsMapCanvasStatus) => void;
};

// ==============================
// Utils
// ==============================
function styleForTheme(mode: ThemeMode): string {
  return mode === "dark" ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
}

function loadMapImage(map: MapboxMap, url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    map.loadImage(url, (err, image) => {
      if (err) reject(err);
      else resolve(image);
    });
  });
}

function round6(n: number): string {
  return (Math.round(n * 1_000_000) / 1_000_000).toString();
}

function signatureForPoints(list: ReadonlyArray<VehiclePoint>, busy: ReadonlySet<string>): string {
  if (list.length === 0) return "0";
  // stable signature: id + coords
  return list
    .map((v) => `${v.vehicleId}:${round6(v.lng)}:${round6(v.lat)}:${busy.has(v.vehicleId) ? 1 : 0}`)
    .sort()
    .join("|");
}

// ==============================
// Component
// ==============================
const OpsMapCanvas = React.forwardRef<OpsMapCanvasHandle, OpsMapCanvasProps>(
  function OpsMapCanvas(props, ref): React.JSX.Element {
    const {
      view,
      vehiclesForRender,
      vehiclesForSearch,
      busyVehicleIds,
      themeMode,
      onSelectVehicleId,
      onStatusChange,
    } = props;

    // ------------------------------
    // Refs
    // ------------------------------
    const mapElRef = React.useRef<HTMLDivElement>(null);
    const mapRef = React.useRef<MapboxMap | null>(null);

    const themeRef = React.useRef<ThemeMode>(themeMode);
    themeRef.current = themeMode;

    const viewRef = React.useRef<OpsMapView>(view);
    viewRef.current = view;

    const lastStyleRef = React.useRef<string | null>(null);

    const vehiclesRef = React.useRef<Map<string, VehiclePoint>>(new Map<string, VehiclePoint>());

    const onSelectRef = React.useRef(onSelectVehicleId);
    onSelectRef.current = onSelectVehicleId;

    const onStatusRef = React.useRef(onStatusChange);
    onStatusRef.current = onStatusChange;

    const layerClickHandlerRef = React.useRef<((ev: LayerClickEvent) => void) | null>(null);

    const lastDataSigRef = React.useRef<string>("__init__");

    // ------------------------------
    // Keep search index in a ref
    // ------------------------------
    React.useEffect(() => {
      const m = new Map<string, VehiclePoint>();
      for (const v of vehiclesForSearch) m.set(v.vehicleId, v);
      vehiclesRef.current = m;
    }, [vehiclesForSearch]);

    const ensureLayerStack = React.useCallback(async (map: MapboxMap): Promise<void> => {
      // icon
      if (!map.hasImage(TAXI_ICON_ID)) {
        const img = await loadMapImage(map, TAXI_ICON_SRC);
        if (!map.hasImage(TAXI_ICON_ID)) map.addImage(TAXI_ICON_ID, img as never);
      }

      if (!map.hasImage(TAXI_BUSY_ICON_ID)) {
        const imgBusy = await loadMapImage(map, TAXI_BUSY_ICON_SRC);
        if (!map.hasImage(TAXI_BUSY_ICON_ID)) map.addImage(TAXI_BUSY_ICON_ID, imgBusy as never);
      }

      // source
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      // layer
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: "symbol",
          source: SOURCE_ID,
          layout: {
            "icon-image": ["case", ["get", "busy"], TAXI_BUSY_ICON_ID, TAXI_ICON_ID],
            "icon-size": 1,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,

            "text-field": ["get", "vehicleId"],
            "text-size": 12,
            "text-anchor": "top",
            "text-offset": [0, -1.2],
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: {
            "text-halo-color": "rgba(255,255,255,0.95)",
            "text-halo-width": 2,
          },
        });
      }

      // click handler — re-bind after setStyle (style.load)
      if (!layerClickHandlerRef.current) {
        layerClickHandlerRef.current = (ev: LayerClickEvent) => {
          const f = ev.features && ev.features[0];
          if (!f) return;

          const props2 = f.properties as unknown;
          if (!props2 || typeof props2 !== "object") return;

          const v = props2 as { vehicleId?: unknown };
          if (typeof v.vehicleId !== "string" || v.vehicleId.trim().length === 0) return;

          onSelectRef.current(v.vehicleId);
        };
      }

      try {
        map.off("click", LAYER_ID, layerClickHandlerRef.current as never);
      } catch {
        // ignore
      }
      map.on("click", LAYER_ID, layerClickHandlerRef.current as never);
    }, []);

    // ------------------------------
    // Init map (client-only) — runs once
    // ------------------------------
    React.useEffect(() => {
      const el = mapElRef.current;
      if (!el) return;

      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!token || token.trim().length === 0) {
        onStatusRef.current({
          ok: false,
          error: "Missing NEXT_PUBLIC_MAPBOX_TOKEN in controlcenter/.env.local",
        });
        return;
      }

      let disposed = false;

      (async () => {
        try {
          const raw = (await import("mapbox-gl")) as unknown;
          const m = raw as MapboxModule;
          if (disposed) return;

          m.default.accessToken = token;

          const initialStyle = styleForTheme(themeRef.current);
          lastStyleRef.current = initialStyle;

          const v = viewRef.current;

          const map = new m.default.Map({
            container: el,
            style: initialStyle,
            center: v.center as unknown as [number, number],
            zoom: v.zoom,
          });

          mapRef.current = map;

          const nav = new m.default.NavigationControl({
            visualizePitch: true,
          }) as unknown as IControl;
          map.addControl(nav, "top-right");

          const onReady = async () => {
            if (disposed) return;

            try {
              await ensureLayerStack(map);
              map.resize();
              onStatusRef.current({ ok: true, error: null });
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Mapbox layer init failed";
              onStatusRef.current({ ok: false, error: msg });
            }
          };

          map.on("load", () => void onReady());
          map.on("style.load", () => void onReady());
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Mapbox init failed";
          onStatusRef.current({ ok: false, error: msg });
        }
      })();

      return () => {
        disposed = true;

        const map = mapRef.current;
        mapRef.current = null;

        try {
          map?.remove();
        } catch {
          // ignore
        }
      };
    }, [ensureLayerStack]);

    // ------------------------------
    // Theme -> style switch
    // ------------------------------
    React.useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      const nextStyle = styleForTheme(themeMode);
      if (lastStyleRef.current === nextStyle) return;

      lastStyleRef.current = nextStyle;

      try {
        map.setStyle(nextStyle);
      } catch {
        // ignore
      }
    }, [themeMode]);

    // ------------------------------
    // View change (city switch) -> jumpTo
    // ------------------------------
    React.useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      try {
        map.stop();
        map.jumpTo({
          center: view.center as unknown as [number, number],
          zoom: view.zoom,
        });
      } catch {
        // ignore
      }
    }, [view.center, view.zoom]);

    // ------------------------------
    // Render markers (skip if unchanged)
    // ------------------------------
    React.useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (!src) return;

      const sig = signatureForPoints(vehiclesForRender, busyVehicleIds);
      if (lastDataSigRef.current === sig) return;
      lastDataSigRef.current = sig;

      const features: VehicleFeature[] = vehiclesForRender.map((v) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [v.lng, v.lat] },
        properties: { vehicleId: v.vehicleId, ts: v.ts, busy: busyVehicleIds.has(v.vehicleId) },
      }));

      const data: VehicleFeatureCollection = { type: "FeatureCollection", features };
      src.setData(data);
    }, [vehiclesForRender, busyVehicleIds]);

    // ------------------------------
    // Imperative API
    // ------------------------------
    const focusVehicle = React.useCallback((vehicleId: string): boolean => {
      const map = mapRef.current;
      if (!map) return false;

      const v = vehiclesRef.current.get(vehicleId);
      if (!v) return false;

      try {
        map.flyTo({
          center: [v.lng, v.lat],
          zoom: FOCUS_ZOOM,
          essential: true,
        });
        onSelectRef.current(vehicleId);
        return true;
      } catch {
        return false;
      }
    }, []);

    const resetView = React.useCallback((): void => {
      const map = mapRef.current;
      if (!map) return;

      const v = viewRef.current;

      try {
        map.flyTo({
          center: v.center as unknown as [number, number],
          zoom: v.zoom,
          essential: true,
        });
      } catch {
        // ignore
      }
    }, []);

    React.useImperativeHandle(
      ref,
      () => ({
        focusVehicle,
        resetView,
      }),
      [focusVehicle, resetView],
    );

    return <div ref={mapElRef} className={s.mapFill} aria-label="Map canvas" />;
  },
);

export default OpsMapCanvas;

// controlcenter/components/ops/map/OpsHud.tsx

// ==============================
// Imports
// ==============================
import * as React from "react";

import * as hud from "../../../styles/ops/opsHud.css";
import * as s from "../../../styles/ops/opsMap.css";
import ThemeSwitcher from "../../ThemeSwitcher";
import type { ThemeMode } from "./opsMap.types";

// ==============================
// Types
// ==============================
export type OpsHudProps = {
  hudCollapsed: boolean;
  onToggleHud: () => void;

  themeMode: ThemeMode;

  connected: boolean;
  ready: boolean;
  lastError: string | null;

  cityId: string;
  dispatchPhone: string | null;
  dispatchHref: string | null;

  topic: string;

  onlineCount: number;
  offlineCount: number;

  mapOk: boolean;
  mapError: string | null;

  fleetError: string | null;
  cityError: string | null;

  eventsCount: number;
  lastPointsCount: number;
  lastPresenceCount: number;
  fleetCount: number;
};

// ==============================
// Component
// ==============================
export default function OpsHud(props: OpsHudProps): React.JSX.Element {
  const {
    hudCollapsed,
    onToggleHud,
    themeMode,
    connected,
    ready,
    lastError,
    cityId,
    dispatchPhone,
    dispatchHref,
    topic,
    onlineCount,
    offlineCount,
    mapOk,
    mapError,
    fleetError,
    cityError,
    eventsCount,
    lastPointsCount,
    lastPresenceCount,
    fleetCount,
  } = props;

  return (
    <>
      <aside
        className={`${s.hud} ${hudCollapsed ? s.hudCollapsed : ""}`}
        aria-label="HUD"
        data-collapsed={hudCollapsed ? "1" : "0"}
      >
        <button
          className={hud.edgeToggle}
          type="button"
          onClick={onToggleHud}
          aria-pressed={hudCollapsed ? "true" : "false"}
          aria-label={hudCollapsed ? "Extinde HUD" : "Restrânge HUD"}
        >
          <span className={hud.edgeChevron} aria-hidden="true">
            {hudCollapsed ? "›" : "‹"}
          </span>
        </button>

        <div className={s.hudInner}>
          <header className={hud.header}>
            <div className={hud.headerMain}>
              <div className={hud.brandRow}>
                <div className={hud.brandTitle}>Taxi Galant</div>
              </div>
              <div className={hud.pageTitle}>CONTROL CENTER / MAP</div>
            </div>
          </header>

          <div className={hud.body}>
            <section className={hud.section} aria-label="Critical status">
              <div className={hud.sectionTitle}>Status</div>

              <div className={hud.actionsRow} aria-label="Status actions">
                <div className={hud.themeInline}>
                  <ThemeSwitcher />
                  <span className={hud.themeValue}>{themeMode.toUpperCase()}</span>
                </div>

                <div className={hud.actionsPills}>
                  <span className={hud.actionPill}>online {onlineCount}</span>
                  <span className={hud.actionPillMuted}>offline {offlineCount}</span>
                </div>
              </div>

              <div className={hud.kvGrid}>
                <div className={hud.kv}>
                  <div className={hud.k}>WS</div>
                  <div className={hud.v}>
                    <span
                      className={`${hud.dot} ${connected ? hud.dotOn : ""}`}
                      aria-hidden="true"
                    />
                    {connected ? "CONNECTED" : "DISCONNECTED"}
                  </div>
                </div>

                <div className={hud.kv}>
                  <div className={hud.k}>City</div>
                  <div className={hud.vMono}>{cityId}</div>
                </div>

                {dispatchPhone && dispatchHref ? (
                  <div className={hud.kv}>
                    <div className={hud.k}>Dispatch</div>
                    <a className={hud.vLinkMono} href={dispatchHref}>
                      {dispatchPhone}
                    </a>
                  </div>
                ) : null}

                {mapOk ? (
                  <div className={hud.kv}>
                    <div className={hud.k}>Map</div>
                    <div className={hud.vOk}>OK</div>
                  </div>
                ) : (
                  <div className={hud.kv}>
                    <div className={hud.k}>Map</div>
                    <div className={hud.vErr}>ERROR</div>
                  </div>
                )}
              </div>

              {mapError ? <div className={hud.alert}>Map error: {mapError}</div> : null}
              {lastError ? <div className={hud.alert}>WS error: {lastError}</div> : null}
              {fleetError ? <div className={hud.alert}>Fleet error: {fleetError}</div> : null}
              {cityError ? <div className={hud.alert}>City error: {cityError}</div> : null}
            </section>

            <section className={hud.sectionMuted} aria-label="Debug">
              <div className={hud.sectionTitle}>Debug</div>

              <div className={hud.kvGrid}>
                <div className={hud.kv}>
                  <div className={hud.k}>ready</div>
                  <div className={hud.vMono}>{ready ? "true" : "false"}</div>
                </div>

                <div className={hud.kv}>
                  <div className={hud.k}>topic</div>
                  <div className={hud.vMono}>{topic}</div>
                </div>

                <div className={hud.kv}>
                  <div className={hud.k}>events</div>
                  <div className={hud.vMono}>{eventsCount}</div>
                </div>

                <div className={hud.kv}>
                  <div className={hud.k}>lastPoints</div>
                  <div className={hud.vMono}>{lastPointsCount}</div>
                </div>

                <div className={hud.kv}>
                  <div className={hud.k}>lastPresence</div>
                  <div className={hud.vMono}>{lastPresenceCount}</div>
                </div>

                <div className={hud.kv}>
                  <div className={hud.k}>fleet</div>
                  <div className={hud.vMono}>{fleetCount}</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </aside>

      {hudCollapsed ? <div className={s.hudRail} aria-label="Collapsed HUD rail" /> : null}
    </>
  );
}

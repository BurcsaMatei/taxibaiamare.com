// controlcenter/lib/realtime/controlcenterWs.ts

// ==============================
// Imports
// ==============================
import type { RealtimeEnvelope } from "@taxi/shared";
import * as React from "react";

// ==============================
// Types
// ==============================
export type ControlcenterWsState = {
  readonly connected: boolean;
  readonly ready: boolean;
  readonly topic: string | null;
  readonly lastError: string | null;
  readonly events: ReadonlyArray<RealtimeEnvelope>;
};

type WsIncoming =
  | { type: "ready" }
  | { type: "subscribed"; topic: string }
  | { type: "unsubscribed"; topic: string }
  | { type: "event"; topic: string; event: RealtimeEnvelope }
  | { type: "error"; error: string }
  | { type: "ping" };

type WsOutgoing =
  { type: "subscribe"; topic: string } | { type: "unsubscribe"; topic: string } | { type: "ping" };

// ==============================
// Constante
// ==============================
const DEFAULT_WS_URL = "ws://localhost:3001/ws";
const MAX_EVENTS = 500;

// ==============================
// Utils
// ==============================
function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function isWsIncoming(v: unknown): v is WsIncoming {
  if (!isObject(v)) return false;
  const t = v.type;
  if (typeof t !== "string") return false;

  if (t === "ready") return true;
  if (t === "ping") return true;

  if (t === "subscribed" || t === "unsubscribed") {
    return typeof v.topic === "string";
  }

  if (t === "error") {
    return typeof v.error === "string";
  }

  if (t === "event") {
    if (typeof v.topic !== "string") return false;
    const ev = (v as { event?: unknown }).event;
    return isObject(ev) && typeof ev.name === "string" && typeof ev.ts === "string";
  }

  return false;
}

function toWsUrl(url?: string): string {
  if (typeof url === "string" && url.trim().length > 0) return url.trim();
  const env = process.env.NEXT_PUBLIC_TAXI_WS_URL;
  if (typeof env === "string" && env.trim().length > 0) return env.trim();
  return DEFAULT_WS_URL;
}

function withToken(wsUrl: string, token?: string): string {
  const t = typeof token === "string" ? token.trim() : "";
  if (!t) return wsUrl;

  try {
    const u = new URL(wsUrl);
    u.searchParams.set("token", t);
    return u.toString();
  } catch {
    // fallback best-effort (assume no query)
    const sep = wsUrl.includes("?") ? "&" : "?";
    return `${wsUrl}${sep}token=${encodeURIComponent(t)}`;
  }
}

function send(ws: WebSocket, msg: WsOutgoing): void {
  ws.send(JSON.stringify(msg));
}

// ==============================
// Hook
// ==============================
export function useControlcenterTopicEvents(
  topic: string,
  opts?: { wsUrl?: string; maxEvents?: number; authToken?: string; enabled?: boolean },
): ControlcenterWsState {
  const enabled = opts?.enabled ?? true;

  const baseWsUrl = toWsUrl(opts?.wsUrl);
  const wsUrl = withToken(baseWsUrl, opts?.authToken);

  const maxEvents =
    typeof opts?.maxEvents === "number" && opts.maxEvents > 10 ? opts.maxEvents : MAX_EVENTS;

  const topicRef = React.useRef(topic);
  topicRef.current = topic;

  const wsRef = React.useRef<WebSocket | null>(null);
  const retryRef = React.useRef(0);
  const aliveRef = React.useRef(true);

  const [state, setState] = React.useState<ControlcenterWsState>(() => ({
    connected: false,
    ready: false,
    topic: null,
    lastError: null,
    events: [],
  }));

  React.useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      const ws = wsRef.current;
      wsRef.current = null;

      try {
        ws?.close();
      } catch {
        // ignore
      }

      setState((prev) => ({
        ...prev,
        connected: false,
        ready: false,
        topic: null,
        lastError: null,
      }));

      return;
    }

    const isBrowser = typeof window !== "undefined";
    if (!isBrowser) return;

    let closeRequested = false;
    let pingTimer: number | null = null;

    const connect = () => {
      if (closeRequested) return;

      setState((prev) => ({
        ...prev,
        connected: false,
        ready: false,
        topic: null,
        lastError: null,
      }));

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const clearPing = () => {
        if (pingTimer) window.clearInterval(pingTimer);
        pingTimer = null;
      };

      ws.addEventListener("open", () => {
        if (!aliveRef.current) return;

        retryRef.current = 0;

        setState((prev) => ({
          ...prev,
          connected: true,
          lastError: null,
        }));

        send(ws, { type: "subscribe", topic: topicRef.current });

        clearPing();
        pingTimer = window.setInterval(() => {
          try {
            if (ws.readyState === WebSocket.OPEN) send(ws, { type: "ping" });
          } catch {
            // ignore
          }
        }, 25_000);
      });

      ws.addEventListener("message", (ev) => {
        if (!aliveRef.current) return;
        if (typeof ev.data !== "string") return;

        const parsed = safeJsonParse(ev.data);
        if (!isWsIncoming(parsed)) return;

        if (parsed.type === "ready") {
          setState((prev) => ({ ...prev, ready: true }));
          return;
        }

        if (parsed.type === "subscribed") {
          setState((prev) => ({ ...prev, topic: parsed.topic }));
          return;
        }

        if (parsed.type === "error") {
          setState((prev) => ({ ...prev, lastError: parsed.error }));
          return;
        }

        if (parsed.type === "event") {
          setState((prev) => {
            const next = [...prev.events, parsed.event];
            const cut = next.length > maxEvents ? next.slice(next.length - maxEvents) : next;
            return { ...prev, events: cut };
          });
        }
      });

      ws.addEventListener("close", () => {
        if (!aliveRef.current) return;

        clearPing();

        setState((prev) => ({
          ...prev,
          connected: false,
          ready: false,
          topic: null,
        }));

        if (closeRequested) return;

        retryRef.current += 1;
        const step = Math.min(10, retryRef.current);
        const delay = 250 * step * step;
        window.setTimeout(() => {
          if (!aliveRef.current) return;
          connect();
        }, delay);
      });

      ws.addEventListener("error", () => {
        if (!aliveRef.current) return;
        setState((prev) => ({
          ...prev,
          lastError: "ws error",
        }));
      });
    };

    connect();

    return () => {
      closeRequested = true;
      const ws = wsRef.current;
      wsRef.current = null;

      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          send(ws, { type: "unsubscribe", topic: topicRef.current });
        }
      } catch {
        // ignore
      }

      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [enabled, maxEvents, topic, wsUrl]);

  React.useEffect(() => {
    if (!enabled) return;

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    try {
      send(ws, { type: "subscribe", topic });
    } catch {
      // ignore
    }
  }, [enabled, topic]);

  return state;
}

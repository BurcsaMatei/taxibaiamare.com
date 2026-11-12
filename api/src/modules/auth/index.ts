// api/src/modules/auth/index.ts

// ==============================
// Imports
// ==============================
import type { Express, Request, Response } from "express";
import type { ControlcenterScope, ControlcenterTokenPayload } from "@taxi/shared";

import { signControlcenterToken } from "./controlcenterToken.js";
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "./loginRateLimit.js";
import { verifyPassword } from "./password.js";

// ==============================
// Types
// ==============================
type LoginBody = {
  password?: unknown;
};

type LoginOk = {
  ok: true;
  token: string;
  scope: ControlcenterScope;
  cityId: string;
  exp: number;
};

type LoginErr = {
  ok: false;
  error: string;
};

// ==============================
// Constante
// ==============================
const DEFAULT_HQ_CITY_ID = "baia-mare";
const DEFAULT_TTL_SEC = 86_400;

// ==============================
// Utils
// ==============================
function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function readEnv(name: string): string | null {
  const v = process.env[name];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function readIntEnv(name: string): number | null {
  const v = readEnv(name);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function bad(res: Response, code: number, msg: string): void {
  const body: LoginErr = { ok: false, error: msg };
  res.status(code).json(body);
}

// ==============================
// Module
// ==============================
export function registerAuthModule(app: Express): void {
  app.post("/auth/controlcenter/login", async (req: Request, res: Response) => {
    const secret = readEnv("TAXI_AUTH_TOKEN_SECRET");
    const passwordHash = readEnv("TAXI_CONTROL_CENTER_PASSWORD_HASH");
    const hqCityId = (readEnv("TAXI_CONTROL_CENTER_HQ_CITY_ID") ?? DEFAULT_HQ_CITY_ID).toLowerCase();

    if (!secret) return bad(res, 500, "Missing TAXI_AUTH_TOKEN_SECRET");
    if (!passwordHash) return bad(res, 500, "Missing TAXI_CONTROL_CENTER_PASSWORD_HASH");

    const ttl = readIntEnv("TAXI_AUTH_TOKEN_TTL_SEC") ?? DEFAULT_TTL_SEC;

    const ip = req.ip ?? "unknown";
    if (isLoginBlocked(ip)) return bad(res, 429, "Prea multe încercări. Reîncearcă peste un minut.");

    const body = req.body as unknown;
    const b = (isObject(body) ? (body as LoginBody) : {}) as LoginBody;
    const password = typeof b.password === "string" ? b.password : "";

    if (!password) return bad(res, 400, "Missing password");

    const valid = await verifyPassword(password, passwordHash);
    if (!valid) {
      recordLoginFailure(ip);
      return bad(res, 401, "Parolă greșită");
    }

    clearLoginFailures(ip);

    const n = nowSec();
    const exp = n + ttl;

    const payload: ControlcenterTokenPayload = {
      v: 1,
      sub: "controlcenter",
      scope: "hq",
      iat: n,
      exp,
    };

    const out: LoginOk = {
      ok: true,
      token: signControlcenterToken(secret, payload),
      scope: "hq",
      cityId: hqCityId,
      exp,
    };

    res.status(200).json(out);
  });
}

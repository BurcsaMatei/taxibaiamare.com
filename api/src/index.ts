// api/src/index.ts

// ==============================
// Imports
// ==============================
import http from "node:http";
import express from "express";
import type { OrderStatus } from "@taxi/shared";

import { registerAuthModule, requireAuth } from "./modules/auth/index.js";
import { registerCitiesModule } from "./modules/cities/index.js";
import { registerOrdersModule } from "./modules/orders/index.js";
import { createRealtimeHub } from "./modules/realtime/wsServer.js";
import { registerVehiclesModule } from "./modules/vehicles/index.js";

// ==============================
// App
// ==============================
const app = express();
app.use(express.json());

// ==============================
// Routes
// ==============================
app.get("/health", (_req, res) => {
  const status: OrderStatus = "NEW";
  res.status(200).json({ ok: true, sharedStatus: status });
});

// ==============================
// Server
// ==============================
const port = Number(process.env.PORT || 3001);

const server = http.createServer(app);
const hub = createRealtimeHub();

// ==============================
// Modules
// ==============================
registerAuthModule(app);

// Tot ce e înregistrat mai jos cere token (login și /health rămân publice).
app.use(requireAuth);

registerCitiesModule(app);
registerOrdersModule(app, hub);
registerVehiclesModule(app, hub);

// ==============================
// WS Upgrade
// ==============================
server.on("upgrade", (req, socket, head) => {
  hub.handleUpgrade(req, socket, head);
});

// ==============================
// Listen
// ==============================
server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on :${port} (http + ws /ws)`);
});
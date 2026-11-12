// scripts/dev-all.mjs
//
// Pornește tot ce trebuie local: build shared + api, apoi API (:3001) și controlcenter (:3000)
// în același terminal. Ctrl+C le oprește pe amândouă.
// Folosire:  npm run dev:all

// ==============================
// Imports
// ==============================
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

// ==============================
// Preflight
// ==============================
if (!existsSync("api/.env.local")) {
  console.error("Lipsește api/.env.local — copiază api/.env.example și completează valorile.");
  process.exit(1);
}

// ==============================
// Build (ordinea contează: shared întâi)
// ==============================
for (const args of [
  ["-w", "packages/shared", "run", "build"],
  ["-w", "api", "run", "build"],
]) {
  console.log(`[dev:all] npm ${args.join(" ")}`);
  const r = spawnSync("npm", args, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// ==============================
// Procese
// ==============================
const children = [];

function run(label, cmd, args) {
  const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);

  const pipe = (stream, out) => {
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) out.write(`[${label}] ${line}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on("exit", (code) => {
    console.log(`[dev:all] ${label} s-a oprit (cod ${code ?? "?"}) — opresc și restul.`);
    shutdown(code ?? 0);
  });
}

let closing = false;
function shutdown(code) {
  if (closing) return;
  closing = true;
  for (const c of children) if (c.exitCode === null) c.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run("api", "node", ["--env-file=api/.env.local", "api/dist/index.js"]);
run("cc ", "npm", ["run", "dev:controlcenter"]);

console.log("[dev:all] API → http://localhost:3001 · Controlcenter → http://localhost:3000");

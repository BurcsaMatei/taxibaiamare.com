// scripts/migrate.ts
//
// Aplică migrațiile SQL din api/migrations/ în ordinea numelor, fiecare o singură dată.
// Ține evidența în tabela `schema_migrations` (nume + sumă de control).
// Folosire:  npm run migrate        (citește DATABASE_URL din api/.env.local sau din mediu)
//            DATABASE_URL='postgresql://…' npm run migrate
// Regulă: o migrație care a rulat nu se mai editează (scriptul oprește dacă îi găsește altă sumă de control).

// ==============================
// Imports
// ==============================
import crypto from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createPool, getDatabaseUrl } from "../api/src/db/pool.js";

// ==============================
// Config
// ==============================
const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "api",
  "migrations",
);

// Numele trebuie să înceapă cu număr (001_…) ca ordinea să fie fără ambiguitate.
const MIGRATION_NAME = /^\d{3,}_[a-z0-9_]+\.sql$/;

// Cheie arbitrară pentru lock-ul care oprește două rulări simultane.
const LOCK_KEY = 7243901;

// ==============================
// Utils
// ==============================
function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// ==============================
// Main
// ==============================
async function main(): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) {
    // eslint-disable-next-line no-console
    console.error(
      "Setează DATABASE_URL (în api/.env.local sau în mediu). Ex: DATABASE_URL='postgresql://…' npm run migrate",
    );
    process.exit(1);
  }

  const all = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const invalid = all.filter((f) => !MIGRATION_NAME.test(f));
  if (invalid.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Nume de migrație invalid (așteptat 001_descriere.sql): ${invalid.join(", ")}`);
    process.exit(1);
  }

  const pool = createPool(url, { max: 1 });
  const client = await pool.connect();

  try {
    await client.query(
      `create table if not exists schema_migrations (
         name       text primary key,
         checksum   text not null,
         applied_at timestamptz not null default now()
       )`,
    );

    let appliedNow = 0;

    for (const file of all) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      const checksum = sha256(sql);

      await client.query("begin");
      try {
        // Lock pe durata tranzacției: funcționează și prin pooler (mod tranzacție).
        await client.query("select pg_advisory_xact_lock($1)", [LOCK_KEY]);

        const done = await client.query<{ checksum: string }>(
          "select checksum from schema_migrations where name = $1",
          [file],
        );

        const existing = done.rows[0];
        if (existing) {
          if (existing.checksum !== checksum) {
            throw new Error(
              `${file} a fost modificată după ce a rulat. Nu edita migrațiile aplicate — adaugă una nouă.`,
            );
          }
          await client.query("commit");
          // eslint-disable-next-line no-console
          console.log(`= ${file} (deja aplicată)`);
          continue;
        }

        await client.query(sql);
        await client.query("insert into schema_migrations (name, checksum) values ($1, $2)", [
          file,
          checksum,
        ]);
        await client.query("commit");
        appliedNow += 1;
        // eslint-disable-next-line no-console
        console.log(`+ ${file}`);
      } catch (e) {
        await client.query("rollback");
        throw e;
      }
    }

    // eslint-disable-next-line no-console
    console.log(`Gata: ${appliedNow} migrații noi, ${all.length - appliedNow} deja aplicate.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

// scripts/hash-password.ts
//
// Generează hash-ul pentru TAXI_CONTROL_CENTER_PASSWORD_HASH.
// Folosire:  PASSWORD='parola' npm run hash:password
// (parola din env, nu din argumente, ca să nu ajungă în istoricul shell-ului)

// ==============================
// Imports
// ==============================
import { hashPassword } from "../api/src/modules/auth/password.js";

// ==============================
// Main
// ==============================
const password = process.env.PASSWORD ?? "";

if (!password) {
  // eslint-disable-next-line no-console
  console.error("Setează PASSWORD în env. Ex: PASSWORD='parola' npm run hash:password");
  process.exit(1);
}

hashPassword(password)
  .then((h) => {
    // eslint-disable-next-line no-console
    console.log(`TAXI_CONTROL_CENTER_PASSWORD_HASH=${h}`);
  })
  .catch((e: unknown) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  });

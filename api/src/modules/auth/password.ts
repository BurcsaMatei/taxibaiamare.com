// api/src/modules/auth/password.ts

// ==============================
// Imports
// ==============================
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// ==============================
// Constante
// ==============================
// Format stocat în env: scrypt$<saltHex>$<hashHex>
const PREFIX = "scrypt";
const KEY_LEN = 64;
const SALT_LEN = 16;

// ==============================
// Utils
// ==============================
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

// ==============================
// API
// ==============================
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await derive(password, salt);
  return `${PREFIX}$${salt.toString("hex")}$${key.toString("hex")}`;
}

/** Întoarce false la orice format invalid — nu aruncă. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.trim().split("$");
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;

  const salt = Buffer.from(parts[1] ?? "", "hex");
  const expected = Buffer.from(parts[2] ?? "", "hex");
  if (salt.length === 0 || expected.length !== KEY_LEN) return false;

  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected);
}

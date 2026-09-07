// lib/utils/server.ts
//
// SERVER-ONLY. Uses Node's `crypto` module and reads a server-side secret.
// Do not import this from Client Components — it will break the client
// bundle (or leak the secret) if pulled into browser code, and is never
// re-exported from the universal `@/lib/utils` barrel.
//
// Migrated from the CodeIgniter `encrypt_decrypt()` helper (const_helper.php),
// which used a hardcoded AES-256-CBC key/IV pair. This version keeps the same
// algorithm but reads the secret from an environment variable instead of
// hardcoding it, and derives a fresh random IV per call (stored alongside the
// ciphertext) rather than reusing a single static IV for every value.
//
// Use this for reversible, field-level encryption of sensitive column values
// (e.g. the `encrypted_cols` concept referenced by the legacy table/import
// helpers). Do NOT use this for password storage — see lib/auth/password.ts
// for one-way password hashing, which is the correct tool for that job.
//
// import { encrypt, decrypt } from "@/lib/utils/server";

import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

function getKey(secret?: string): Buffer {
  const raw = secret ?? process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "Missing encryption key: set FIELD_ENCRYPTION_KEY in the environment, or pass a secret explicitly."
    );
  }
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Encrypts a string, returning `iv:ciphertext` (both hex-encoded) so the
 * random IV can be recovered on decrypt.
 */
export function encrypt(plainText: string, secret?: string): string {
  const key = getKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a string produced by `encrypt`. Returns null if the input is
 * malformed rather than throwing, so callers can handle bad/legacy data
 * gracefully.
 */
export function decrypt(cipherText: string, secret?: string): string | null {
  const parts = cipherText.split(":");
  if (parts.length !== 2) return null;

  const [ivHex, dataHex] = parts;
  try {
    const key = getKey(secret);
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
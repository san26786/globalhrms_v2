import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * GlobalHRMS password hashing.
 *
 * Legacy `user_mst.PASSWORD` values from the old system are 32-character
 * hexadecimal MD5 hashes. New accounts are hashed with bcrypt. `verifyPassword`
 * accepts either, so existing users keep working while new ones are protected.
 */

const MD5_HEX = /^[a-f0-9]{32}$/;
const BCRYPT_PREFIX = /^\$2[aby]\$/;
const BCRYPT_ROUNDS = 12;

/** True when the stored hash is an old MD5 value rather than a bcrypt one. */
export function isLegacyHash(storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  return MD5_HEX.test(storedHash.trim().toLowerCase());
}

/** MD5 — kept only to verify (and migrate) pre-existing hashes. Never use for new passwords. */
export function hashLegacyPassword(password: string): string {
  return crypto.createHash("md5").update(password).digest("hex");
}

/** The hashing used for all new passwords. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyLegacyPassword(
  password: string,
  storedHash: string | null | undefined
): boolean {
  const expected = (storedHash ?? "").trim().toLowerCase();

  if (!MD5_HEX.test(expected)) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(hashLegacyPassword(password), "utf8"),
    Buffer.from(expected, "utf8")
  );
}

/**
 * Verifies a password against either hash format.
 * Returns false rather than throwing on a null, empty or unrecognised hash.
 */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  if (!storedHash) return false;

  const hash = storedHash.trim();

  if (MD5_HEX.test(hash.toLowerCase())) {
    return verifyLegacyPassword(password, hash);
  }

  if (BCRYPT_PREFIX.test(hash)) {
    try {
      return await bcrypt.compare(password, hash);
    } catch {
      return false;
    }
  }

  return false;
}

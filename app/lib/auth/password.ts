import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * Password hashing.
 *
 * CI stored user_mst.PASSWORD (and user_password_history.PASSWORD) as unsalted MD5 hex. New and
 * changed passwords are stored as bcrypt; existing MD5 hashes keep working and are upgraded to
 * bcrypt on the next successful login (`needsRehash`). Both columns are wide enough (255 / 100).
 */
const BCRYPT_ROUNDS = 12;
const MD5_HEX = /^[a-f0-9]{32}$/;

export function hashLegacyPassword(password: string): string {
  return crypto.createHash("md5").update(password).digest("hex");
}

export function verifyLegacyPassword(password: string, storedHash: string): boolean {
  const expected = storedHash.trim().toLowerCase();
  if (!MD5_HEX.test(expected)) return false;
  return crypto.timingSafeEqual(Buffer.from(hashLegacyPassword(password), "utf8"), Buffer.from(expected, "utf8"));
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export interface PasswordCheck {
  valid: boolean;
  /** true when the stored hash is legacy MD5 and should be replaced after a successful login. */
  needsRehash: boolean;
}

export async function verifyPassword(password: string, storedHash: string | null | undefined): Promise<PasswordCheck> {
  if (!storedHash) return { valid: false, needsRehash: false };
  const stored = storedHash.trim();
  if (stored.startsWith("$2")) {
    return { valid: await bcrypt.compare(password, stored), needsRehash: false };
  }
  const valid = verifyLegacyPassword(password, stored);
  return { valid, needsRehash: valid };
}

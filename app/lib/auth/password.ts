import crypto from "crypto";

/**
 * GlobalHRMS legacy password hashing.
 *
 * Existing user_mst.PASSWORD values are stored
 * as 32-character hexadecimal MD5 hashes.
 */
export function hashLegacyPassword(password: string): string {
  return crypto
    .createHash("md5")
    .update(password)
    .digest("hex");
}

export function verifyLegacyPassword(
  password: string,
  storedHash: string
): boolean {
  const calculatedHash = hashLegacyPassword(password);

  const expected = storedHash.trim().toLowerCase();

  if (!/^[a-f0-9]{32}$/.test(expected)) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(calculatedHash, "utf8"),
    Buffer.from(expected, "utf8")
  );
}
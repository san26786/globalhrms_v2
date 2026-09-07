// lib/utils/id.ts
//
// Universal (client + server safe) identifier utilities.
//
// `guid` already exists in `@/lib/commonHelpers` (migrated from the
// CodeIgniter `common_helper.php` `GUID()` helper). It's re-exported here so
// all identifier utilities live under one import path.

import { guid } from "@/lib/commonHelpers";

export { guid };

/** Alias of `guid` with a more conventional name for new code. */
export const generateGuid = guid;

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Returns true if the value is a syntactically valid v4 GUID/UUID. */
export function isValidGuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return GUID_PATTERN.test(value);
}

/**
 * Generates a short, random, URL-safe identifier — useful for temporary
 * React keys, draft-row IDs in editable tables, etc. Not cryptographically
 * unique at scale; use `generateGuid` where collision resistance matters.
 */
export function generateShortId(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
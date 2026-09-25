// lib/utils/validation.ts
//
// Universal (client + server safe) primitive validation predicates.
//
// These are lightweight, dependency-free checks for common field shapes
// (email, URL, phone, etc). For structural/schema validation of forms and
// API payloads, this project already uses Zod (see lib/resource and app/validations,
// lib/entity/entityValidation.ts, lib/permission/permissionValidation.ts) —
// prefer a Zod schema over hand-rolled checks when validating a whole object.
// These predicates are best used inside custom Zod `.refine()` calls, or for
// ad-hoc checks outside a schema context.

import { EMAIL_REGEX, PHONE_REGEX } from "@/lib/utils/constants";

export { isEmpty } from "./object";
export { isBlank } from "./string";

/**
 * Basic, pragmatic email format check (not full RFC 5322 validation).
 * Good enough for client-side UX hints; always validate again server-side.
 */
export function isEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  return EMAIL_REGEX.test(value.trim());
}

/** Returns true if the value is a syntactically valid absolute URL. */
export function isValidUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Basic phone number check: allows an optional leading "+", digits, and
 * common separators (spaces, hyphens, parentheses), requiring 7-15 digits
 * overall (per ITU E.164 length guidance). Intended as a light sanity check,
 * not full validation of a specific country's numbering plan.
 */
export function isValidPhone(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!PHONE_REGEX.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** Returns true if a numeric value falls within [min, max] inclusive. */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}
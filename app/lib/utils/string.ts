// lib/utils/string.ts
//
// Universal (client + server safe) string utilities.
//
// `convertToSnakeCase` and `multiStrpos` already exist in
// `@/lib/commonHelpers` (migrated from the CodeIgniter `common_helper.php`).
// They are re-exported here so all string-related utilities live under one
// import path, without duplicating their logic. GUID generation lives in
// id.ts instead, alongside other identifier helpers.

import { convertToSnakeCase, multiStrpos } from "@/lib/commonHelpers";
import { TWO_LEVEL_TLDS } from "@/lib/utils/constants";

export { convertToSnakeCase, multiStrpos };

/** Alias of `multiStrpos` with a name that reflects what it returns. */
export const findFirstOccurrences = multiStrpos;

/**
 * Returns true if the value is null/undefined, or a string containing only
 * whitespace (or an empty string).
 */
export function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

/** Capitalizes the first letter of a string; leaves the rest untouched. */
export function capitalize(value: string | null | undefined): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Converts a string to Title Case (first letter of each word capitalized). */
export function toTitleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => capitalize(word))
    .join(" ");
}

/** Converts snake_case, kebab-case, or space separated text into camelCase. */
export function toCamelCase(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[_\-\s]+(.)?/g, (_, char: string | undefined) => (char ? char.toUpperCase() : ""))
    .replace(/^(.)/, (char) => char.toLowerCase());
}

/** Converts a string to kebab-case (e.g. "Employee Grade" -> "employee-grade"). */
export function toKebabCase(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Truncates a string to a maximum length, appending a suffix (default "…")
 * if truncation occurred. Null/undefined-safe.
 */
export function truncate(
  value: string | null | undefined,
  maxLength: number,
  suffix = "…"
): string {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return value.slice(0, Math.max(0, maxLength - suffix.length)) + suffix;
}

/**
 * Converts a string into a URL-friendly slug.
 * e.g. "Employee Leave Policy (2026)" -> "employee-leave-policy-2026"
 */
export function slugify(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Strips HTML tags from a string, leaving plain text. Suitable for stripping
 * simple markup server-side; for untrusted HTML that must be safely
 * rendered, use a sanitizer instead.
 */
export function stripHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, "");
}

/**
 * Extracts the registrable domain from a URL or hostname string.
 * e.g. "https://sub.example.co.uk/path" -> "example.co.uk"
 *
 * Migrated from the CodeIgniter `get_domain()` helper, rewritten using the
 * native URL API instead of manual string slicing. Handles common two-level
 * TLDs (e.g. .co.uk, .com.au); for exhaustive public-suffix accuracy in
 * production, consider the `psl` package instead.
 */
export function extractDomain(input: string): string | null {
  if (!input) return null;

  let hostname: string;
  try {
    hostname = input.includes("://") ? new URL(input).hostname : input;
  } catch {
    hostname = input;
  }

  hostname = hostname.toLowerCase().replace(/^www\./, "");

  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;

  const lastTwo = parts.slice(-2).join(".");
  const sliceLen = TWO_LEVEL_TLDS.has(lastTwo) ? 3 : 2;

  return parts.slice(-sliceLen).join(".");
}
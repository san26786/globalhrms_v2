// lib/utils/number.ts
//
// Universal (client + server safe) numeric utilities: math and plain-number
// display formatting. Currency-specific formatting (symbols, written-out
// amounts) lives in currency.ts to keep money handling in one place.

import { DEFAULT_LOCALE } from "@/lib/utils/constants";

/**
 * Formats a plain number with locale-aware grouping (e.g. thousands
 * separators), without currency symbols.
 */
export function formatNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
  locale: string | string[] = DEFAULT_LOCALE
): string {
  if (value === null || value === undefined || isNaN(value)) return "";
  return new Intl.NumberFormat(locale, options).format(value);
}

/** Clamps a number between a minimum and maximum (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Rounds a number to a given number of decimal places (default 2).
 * Avoids common floating-point rounding artifacts (e.g. round(1.005, 2)).
 */
export function round(value: number, precision = 2): number {
  const factor = Math.pow(10, precision);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Returns true if a value is a finite number, or a string that parses to one. */
export function isNumeric(value: unknown): boolean {
  if (typeof value === "number") return isFinite(value);
  if (typeof value !== "string" || value.trim() === "") return false;
  return isFinite(Number(value));
}
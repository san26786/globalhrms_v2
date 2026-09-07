// lib/utils/format.ts
//
// Universal (client + server safe) *display* formatting — turning raw
// values into locale-aware, human-readable strings using the native Intl
// API. Cross-cutting formatters live here; domain-specific ones live closer
// to their domain (currency.ts, number.ts) to keep this file focused on
// "presentation," not computation.

import { parseDate } from "@/lib/utils/date";
import { DEFAULT_LOCALE } from "@/lib/utils/constants";

/**
 * Formats a date using the native Intl API.
 *
 * Replaces the CodeIgniter `getDateFormat()` / `getJSDateFormat()` pattern of
 * deriving a hardcoded PHP/JS format pair from a session-stored preference
 * code (e.g. 'DD-MM-YYYY'). Prefer passing the user's locale/preference
 * explicitly rather than reading it from global session state.
 *
 * @example
 * formatDate(new Date(), { dateStyle: "medium" }, "en-GB") // "29 Aug 2026"
 */
export function formatDate(
  value: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short" },
  locale: string | string[] = DEFAULT_LOCALE
): string | null {
  const d = parseDate(value);
  if (!d) return null;
  return new Intl.DateTimeFormat(locale, options).format(d);
}

/**
 * Formats a date relative to now (e.g. "3 days ago", "in 2 hours") using the
 * native Intl.RelativeTimeFormat API.
 */
export function formatRelativeTime(
  value: Date | string | number,
  locale: string | string[] = DEFAULT_LOCALE
): string | null {
  const d = parseDate(value);
  if (!d) return null;

  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(diffSec) >= secondsInUnit || unit === "second") {
      return rtf.format(Math.round(diffSec / secondsInUnit), unit);
    }
  }
  return rtf.format(0, "second");
}

/**
 * Formats a fractional value (0-1) as a percentage string.
 * e.g. formatPercent(0.4567, 1) -> "45.7%"
 */
export function formatPercent(
  value: number | null | undefined,
  decimals = 0,
  locale: string | string[] = DEFAULT_LOCALE
): string {
  if (value === null || value === undefined || isNaN(value)) return "";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formats a byte count into a human-readable file size string.
 * e.g. formatFileSize(1536) -> "1.5 KB"
 */
export function formatFileSize(bytes: number | null | undefined, decimals = 1): string {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return "";
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);

  return `${value.toFixed(exponent === 0 ? 0 : decimals)} ${units[exponent]}`;
}
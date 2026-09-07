// lib/utils/date.ts
//
// Universal (client + server safe) date math utilities.
// For locale-aware *display* formatting (e.g. "29 Aug 2026", "3 days ago"),
// see format.ts — this file is about parsing, validating, and computing
// with dates, not rendering them.
//
// `convertToMysqlDateFormat` and `convertToSystemDateFormat` already exist in
// `@/lib/commonHelpers` (migrated from the CodeIgniter `common_helper.php`).
// They are re-exported here so all date-related utilities live under one
// import path, without duplicating their logic.

import { convertToMysqlDateFormat, convertToSystemDateFormat } from "@/lib/commonHelpers";

export { convertToMysqlDateFormat, convertToSystemDateFormat };

/**
 * Returns true if the given value can be parsed into a valid Date.
 */
export function isValidDate(value: unknown): value is Date | string | number {
  if (value instanceof Date) return !isNaN(value.getTime());
  if (typeof value === "string" || typeof value === "number") {
    return !isNaN(new Date(value).getTime());
  }
  return false;
}

/**
 * Safely coerces a Date | string | number into a Date, or returns null.
 * Exported so format.ts (and other consumers) can reuse the same coercion
 * logic rather than re-implementing it.
 */
export function parseDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a date as an ISO 8601 date string (YYYY-MM-DD), in local time.
 */
export function toISODate(value: Date | string | number | null | undefined): string | null {
  const d = parseDate(value);
  if (!d) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns the number of days in a given month (1-indexed month, 4-digit year).
 * Uses the native Date rollover trick, which correctly accounts for leap
 * years — replacing both the CodeIgniter `days_in_month()` and
 * `cal_days_in_month()` helpers (the latter used a manual leap-year formula).
 */
export function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Adds (or subtracts, with a negative value) a number of days to a date.
 */
export function addDays(value: Date | string | number, days: number): Date {
  const d = parseDate(value) ?? new Date(NaN);
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Returns the whole number of days between two dates (end - start),
 * ignoring time-of-day.
 */
export function diffInDays(
  start: Date | string | number,
  end: Date | string | number
): number | null {
  const a = parseDate(start);
  const b = parseDate(end);
  if (!a || !b) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  const aUTC = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bUTC = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bUTC - aUTC) / msPerDay);
}

/**
 * Returns a list of ISO date strings (YYYY-MM-DD) between a start and end
 * date, inclusive. Use `format.ts`'s `formatDate` on each entry if you need
 * locale-specific display formatting instead.
 *
 * Migrated from the CodeIgniter `date_range()` helper (app_date_helper.php),
 * which supported a UNIX-timestamp end date or a day-count interval. This
 * version accepts either an end date or a number of days directly.
 *
 * @param start      Start date
 * @param endOrDays  End date, or a number of days to span from start
 */
export function dateRange(
  start: Date | string | number,
  endOrDays: Date | string | number
): string[] {
  const from = parseDate(start);
  if (!from) return [];

  const to =
    typeof endOrDays === "number" && !isValidDate(endOrDays)
      ? addDays(from, endOrDays)
      : parseDate(endOrDays);

  if (!to) return [];

  const [lo, hi] = from <= to ? [from, to] : [to, from];
  const range: string[] = [];
  const cursor = new Date(lo);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(hi);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    range.push(toISODate(cursor)!);
    cursor.setDate(cursor.getDate() + 1);
  }

  return range;
}

/**
 * Returns true if the given date is strictly before the current moment.
 */
export function isPastDate(value: Date | string | number): boolean {
  const d = parseDate(value);
  return d !== null && d.getTime() < Date.now();
}

/**
 * Returns true if the given date is strictly after the current moment.
 */
export function isFutureDate(value: Date | string | number): boolean {
  const d = parseDate(value);
  return d !== null && d.getTime() > Date.now();
}
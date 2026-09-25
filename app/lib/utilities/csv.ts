/**
 * CSV writer for the utilities exports (CI dbutil->csv_from_result + force_download).
 *
 * - every value is quoted, embedded quotes doubled (RFC 4180, like csv_from_result);
 * - spreadsheet formula injection is neutralised: a text value starting with = + - @ (or a tab / CR)
 *   is prefixed with a single quote so Excel/Sheets treat it as text;
 * - dates are written as YYYY-MM-DD (date columns) or YYYY-MM-DD HH:MM:SS (timestamps), as MySQL did.
 */

export type CsvValue = string | number | bigint | boolean | Date | null | undefined | { toString(): string };

const FORMULA_START = /^[=+\-@\t\r]/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const isMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  return isMidnight ? date : `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function toText(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDate(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  const text = typeof value === 'string' ? value : value.toString();
  return FORMULA_START.test(text) ? `'${text}` : text;
}

function cell(value: CsvValue): string {
  return `"${toText(value).replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(cell).join(',')];
  for (const row of rows) lines.push(row.map(cell).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

/** Attachment response; the UTF-8 BOM makes Excel read non-ASCII names correctly. */
export function csvResponse(filename: string, csv: string): Response {
  const safeName = filename.replace(/[^A-Za-z0-9_.-]/g, '_');
  return new Response(`﻿${csv}`, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** CI date("Ymd") in server local time. */
export function todayStamp(now: Date = new Date()): string {
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

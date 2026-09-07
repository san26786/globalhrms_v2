// lib/utils/export.ts
//
// CLIENT-ONLY. Composes the pure data transform in csv.ts with the browser
// download primitives in browser.ts, so any feature (Dynamic Tables, Entity
// lists, Reports) can trigger a lightweight CSV export without pulling in
// the heavier `xlsx`/`jspdf` dependencies used by
// `lib/import-export/exportUtils.ts`. For Excel/PDF/print/clipboard-table
// export, that module already covers it — use it directly rather than
// duplicating it here.

import { arrayToCsv } from "@/lib/utils/csv";
import { downloadText } from "@/lib/utils/browser";
import { MIME_TYPES } from "@/lib/utils/constants";

/**
 * Appends today's date to a base filename, e.g.
 * `generateExportFilename("employees")` -> `"employees_2026-08-29"`.
 */
export function generateExportFilename(base: string, extension?: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `${base}_${stamp}`;
  return extension ? `${name}.${extension}` : name;
}

/**
 * Converts records to CSV and triggers a browser download in one call.
 * A thin convenience wrapper — for non-download use cases (e.g. building a
 * CSV to send in an email or API response), call `arrayToCsv` directly.
 */
export function exportRecordsAsCsv<T extends Record<string, unknown>>(
  headers: string[],
  keys: (keyof T)[],
  data: T[],
  filename: string
): void {
  const csv = arrayToCsv(headers, keys, data);
  // Prepend UTF-8 BOM for Excel compatibility with non-ASCII characters.
  downloadText("\uFEFF" + csv, filename.endsWith(".csv") ? filename : `${filename}.csv`, MIME_TYPES.csv);
}
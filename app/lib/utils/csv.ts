// lib/utils/csv.ts
//
// Universal (client + server safe) CSV data transformation — pure string
// building/parsing, with no DOM or browser download logic. That separation
// is intentional (see export.ts): this file can run in an API route to
// stream a CSV response just as easily as in the browser before a download.
//
// `lib/import-export/exportUtils.ts` already has its own `exportToCSV`
// that combines string-building with a browser download trigger for its
// specific import/export feature; it's left as-is to avoid churn. Use this
// file for *new* generic CSV needs (Dynamic Tables, Reports, API exports)
// so data transformation and delivery stay decoupled, per the utility
// framework's design.
//
// Migrated conceptually from the CodeIgniter `array_to_csv()` / `query_to_csv()`
// helpers (csv_helper.php).

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts an array of records into a CSV string.
 *
 * @param headers  Column display labels, in order
 * @param keys     Record keys corresponding to each header, in the same order
 * @param data     Array of records to render as rows
 */
export function arrayToCsv<T extends Record<string, unknown>>(
  headers: string[],
  keys: (keyof T)[],
  data: T[]
): string {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const rowLines = data.map((row) => keys.map((key) => escapeCsvCell(row[key])).join(","));
  return [headerLine, ...rowLines].join("\r\n");
}

/**
 * Parses a CSV string into an array of records keyed by the header row.
 * Handles quoted fields (including embedded commas/newlines/escaped quotes)
 * but is not a full RFC 4180 implementation — for large or exotic CSV
 * inputs, prefer a dedicated library.
 */
export function parseCsv(csv: string): Record<string, string>[] {
  const rows = parseCsvRows(csv);
  if (rows.length === 0) return [];

  const [headerRow, ...dataRows] = rows;
  return dataRows
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => {
      const record: Record<string, string> = {};
      headerRow.forEach((header, i) => {
        record[header.trim()] = row[i] ?? "";
      });
      return record;
    });
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}
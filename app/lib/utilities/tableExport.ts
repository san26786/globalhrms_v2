import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { NotFoundError } from '@/lib/http/errors';
import { toCsv, type CsvValue } from './csv';
import type { ScopedBrand } from './access';

/**
 * Import / Export — port of CI utilities/import_export (EXPORT only).
 *
 * CI offered every database table ($this->db->list_tables()) and exported `SELECT *` optionally
 * filtered by OA_ID / OA_BRAND_ID taken from the URL — i.e. any user with the menu could download
 * user_mst (password hashes, security answers) or other tenants' data. Here:
 *  - only the tables of EXPORTABLE_TABLES can be exported (brand-owned configuration / master data;
 *    no credential, token, audit or employee personal-data tables);
 *  - every whitelisted table has an OA_BRAND_ID column and the export is always filtered by the
 *    validated brand (sysadmin: any brand, admin: brands of their organisation, others: own brand);
 *  - columns are the model's scalar fields (Prisma's generated enum); soft-deleted rows are excluded;
 *  - CSV is escaped and formula-neutralised; file name "{table}.csv" as in CI.
 * CI import (import_export/import) was dead code (var_dump(); die;) and is intentionally not ported.
 */

interface ExportableTable {
  table: Prisma.ModelName;
  label: string;
  /** Column names in schema order. */
  columns: readonly string[];
  /** Soft-delete column + its "not deleted" value, when the table has one. */
  notDeleted?: { column: string; value: number | boolean; nullIsActive?: boolean };
  orderBy: string;
}

export const EXPORTABLE_TABLES: readonly ExportableTable[] = [
  {
    table: 'period_mst',
    label: 'Periods',
    columns: Object.values(Prisma.Period_mstScalarFieldEnum),
    notDeleted: { column: 'IS_DELETED', value: 0 },
    orderBy: 'PERIOD_ID',
  },
  {
    table: 'holiday_mst',
    label: 'Holidays',
    columns: Object.values(Prisma.Holiday_mstScalarFieldEnum),
    notDeleted: { column: 'IS_DELETED', value: 0, nullIsActive: true },
    orderBy: 'HOLIDAY_ID',
  },
  {
    table: 'holiday_grp_dtl',
    label: 'Holiday Group Details',
    columns: Object.values(Prisma.Holiday_grp_dtlScalarFieldEnum),
    orderBy: 'id',
  },
  {
    table: 'oa_brand_settings',
    label: 'Brand Settings',
    columns: Object.values(Prisma.Oa_brand_settingsScalarFieldEnum),
    notDeleted: { column: 'IS_DELETED', value: 0 },
    orderBy: 'OAB_SETTING_ID',
  },
  {
    table: 'independent_mst',
    label: 'Brand Common Masters',
    columns: Object.values(Prisma.Independent_mstScalarFieldEnum),
    notDeleted: { column: 'IS_DELETED', value: false, nullIsActive: true },
    orderBy: 'MSTR_ID',
  },
];

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BRAND_COLUMN = 'OA_BRAND_ID';
const MAX_ROWS = 100_000;

function quoteIdent(name: string): Prisma.Sql {
  if (!IDENTIFIER.test(name)) throw new Error(`tableExport: unsafe identifier "${name}"`);
  return Prisma.raw(`"${name}"`);
}

export function listExportableTables(): Array<{ table: string; label: string }> {
  return EXPORTABLE_TABLES.filter((t) => t.columns.includes(BRAND_COLUMN)).map((t) => ({ table: t.table, label: t.label }));
}

export async function exportTableCsv(tableName: string, brand: ScopedBrand): Promise<{ filename: string; csv: string }> {
  const def = EXPORTABLE_TABLES.find((t) => t.table === tableName);
  // Unknown / non-whitelisted tables and tables without a brand column are refused alike.
  if (!def || !def.columns.includes(BRAND_COLUMN)) throw new NotFoundError('This table cannot be exported.');
  const columns = [...def.columns];

  const conditions: Prisma.Sql[] = [Prisma.sql`${quoteIdent(BRAND_COLUMN)} = ${brand.oaBrandId}`];
  if (def.notDeleted && columns.includes(def.notDeleted.column)) {
    const col = quoteIdent(def.notDeleted.column);
    conditions.push(
      def.notDeleted.nullIsActive
        ? Prisma.sql`(${col} = ${def.notDeleted.value} OR ${col} IS NULL)`
        : Prisma.sql`${col} = ${def.notDeleted.value}`,
    );
  }

  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT ${Prisma.join(columns.map(quoteIdent), ', ')}
    FROM ${quoteIdent(def.table)}
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY ${quoteIdent(def.orderBy)} ASC
    LIMIT ${MAX_ROWS}`;

  const data: CsvValue[][] = rows.map((r) => columns.map((c) => toCsvValue(r[c])));
  return { filename: `${def.table}.csv`, csv: toCsv(columns, data) };
}

function toCsvValue(value: unknown): CsvValue {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean' ||
    value instanceof Date
  ) {
    return value;
  }
  if (value instanceof Uint8Array) return '';
  if (Prisma.Decimal.isDecimal(value)) return value.toString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

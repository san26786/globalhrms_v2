import { prisma } from '@/lib/prisma';

/**
 * Writes for migrated tables whose column types disagree with what CI stored (e.g. an integer
 * POSTAL_CODE, text CURRENCY_ID, everything NOT NULL): every value is cast to the column's actual
 * type, read once from the catalogue. NOT NULL columns without a value get '' / 0, as CI's MySQL did.
 *
 *   const columns = await tableColumns('exit_form_setting');
 *   const params: Array<string | null> = [];
 *   const pairs = bindColumns(columns, { PREFIX: 'EXP', MAIL_PDF: 1 }, params);
 *   await prisma.$executeRawUnsafe(`UPDATE … SET ${pairs.map((p) => `${p.column} = ${p.placeholder}`)} …`, ...params);
 */

export interface ColumnInfo {
  integer: boolean;
  nullable: boolean;
}

export type ColumnValue = string | number | null;

const cache = new Map<string, Map<string, ColumnInfo>>();

export async function tableColumns(table: string): Promise<Map<string, ColumnInfo>> {
  const cached = cache.get(table);
  if (cached) return cached;
  const rows = await prisma.$queryRaw<Array<{ name: string; type: string; nullable: string }>>`
    SELECT column_name AS name, data_type AS type, is_nullable AS nullable
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = ${table}`;
  const map = new Map(
    rows.map((r) => [r.name, { integer: ['integer', 'smallint', 'bigint'].includes(r.type), nullable: r.nullable === 'YES' }]),
  );
  cache.set(table, map);
  return map;
}

/** A value as the column stores it: integer columns get digits (or NULL / 0), text columns text (or NULL / ''). */
function forColumn(info: ColumnInfo, value: ColumnValue): string | null {
  const raw = value === null ? '' : String(value).trim();
  if (info.integer) {
    if (/^-?\d+$/.test(raw)) return raw;
    return info.nullable ? null : '0';
  }
  return raw === '' && info.nullable ? null : raw;
}

/**
 * `"COLUMN"` / `$n::type` pairs for the columns the table has (others are skipped); the values are
 * appended to `params`. Column names come from code, never from input.
 */
export function bindColumns(columns: Map<string, ColumnInfo>, data: Record<string, ColumnValue>, params: Array<string | null>) {
  return Object.entries(data).flatMap(([column, value]) => {
    const info = columns.get(column);
    if (!info) return [];
    params.push(forColumn(info, value));
    return [{ column: `"${column}"`, placeholder: `$${params.length}::${info.integer ? 'integer' : 'text'}` }];
  });
}

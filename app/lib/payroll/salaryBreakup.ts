import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { columnsOf, type Tx } from '@/lib/employeeMngt/hub/hubEngine';
import { prisma } from '@/lib/prisma';
import { centsText, toCents } from './annexure/ruleMath';

/**
 * salary_breakup: one row per employee and financial year (YEAR = the FY's PERIOD_ID) holding the year's salary
 * figures — written by the annexure (monthly / annual salary, CTC) and added to by every payroll run (component
 * year-to-date sums, LOP, tax, cumulative gross); salary_breakup_for_calc: snapshots of that row per month, which the
 * payroll's benefit rules and the tax read. CI always used the first row of (employee, FY). Amounts are cents.
 */
export type BreakupDelta = Record<string, number>;

/** Annexure: the year's monthly salary and gross (CI insertSalaryBreakup / updateSalaryBreakup), on the first row or a new one. */
export async function setSalaryBreakupBase(
  tx: Tx,
  table: 'salary_breakup' | 'salary_breakup_temp',
  v: { emp: number; fy: number; monthly: string; gross: string; oa: number; brand: number; user: number; by: number },
) {
  await assertInsertSafe(table, 'SLB_ID');
  await tx.$executeRawUnsafe(
    `WITH upd AS (
       UPDATE ${table} s SET "MONTHLY_SALARY" = $3::numeric, "CTC" = $4::numeric, "ANNUAL_SALARY" = $4::numeric, "UPDATED_BY" = $8::int, "UPDATED_ON" = now()
       WHERE s."SLB_ID" = (SELECT "SLB_ID" FROM ${table} WHERE "EMP_ID" = $1::int AND "YEAR" = $2::int ORDER BY "SLB_ID" LIMIT 1)
       RETURNING 1)
     INSERT INTO ${table} ("EMP_ID", "YEAR", "MONTHLY_SALARY", "CTC", "ANNUAL_SALARY", "OA_ID", "OA_BRAND_ID", "USER_ID", "IS_DELETED", "CREATED_BY", "CREATED_ON", "UPDATED_BY", "UPDATED_ON")
     SELECT $1::int, $2::int, $3::numeric, $4::numeric, $4::numeric, $5::int, $6::int, $7::int, 0, $8::int, now(), $8::int, now()
     WHERE NOT EXISTS (SELECT 1 FROM upd)`,
    v.emp, v.fy, v.monthly, v.gross, v.oa, v.brand, v.user, v.by,
  );
}

/** CI replicateFromSalaryBreakUp: a snapshot of the FY row for a month (readers take the newest of the month). */
export async function snapshotSalaryBreakup(tx: Tx, emp: number, fy: number, month: number, year: number) {
  await assertInsertSafe('salary_breakup_for_calc', 'SLB_ID');
  const [from, to] = await Promise.all([columnsOf('salary_breakup'), columnsOf('salary_breakup_for_calc')]);
  const shared = [...to.values()].map((c) => c.name).filter((c) => !['SLB_ID', 'MONTH', 'YEAR'].includes(c.toUpperCase()) && from.has(c.toUpperCase()));
  const list = shared.map((c) => `"${c}"`).join(', ');
  await tx.$executeRawUnsafe(
    `INSERT INTO salary_breakup_for_calc ("MONTH", "YEAR", ${list})
     SELECT $3::int, $4::int, ${list} FROM salary_breakup WHERE "EMP_ID" = $1::int AND "YEAR" = $2::int ORDER BY "SLB_ID" LIMIT 1`,
    emp, fy, month, year,
  );
}

let columnCache: Map<number, string> | null = null;

/** salary_breakup_cols: component master id → salary_breakup column (only columns that exist). */
export async function breakupColumns(): Promise<Map<number, string>> {
  if (columnCache) return columnCache;
  const [rows, cols] = await Promise.all([
    prisma.$queryRaw<Array<{ id: number; col: string | null }>>`SELECT "MSTR_ID" AS id, "COL_NAME" AS col FROM salary_breakup_cols WHERE "MSTR_ID" IS NOT NULL ORDER BY "ID"`,
    columnsOf('salary_breakup'),
  ]);
  const map = new Map<number, string>();
  for (const r of rows) {
    const col = (r.col ?? '').trim().toUpperCase();
    if (col && cols.has(col) && !map.has(Number(r.id))) map.set(Number(r.id), cols.get(col)!.name);
  }
  columnCache = map;
  return map;
}

/** The FY row's amounts (cents per column), or null when the employee has none for the year. */
export async function readSalaryBreakup(db: Tx, emp: number, fy: number): Promise<BreakupDelta | null> {
  const [row] = await db.$queryRaw<Array<Record<string, unknown>>>`
    SELECT * FROM salary_breakup WHERE "EMP_ID" = ${emp} AND "YEAR" = ${fy} ORDER BY "SLB_ID" LIMIT 1`;
  if (!row) return null;
  const out: BreakupDelta = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && typeof v === 'object' && 'toFixed' in v) out[k.toUpperCase()] = toCents(String(v));
  }
  return out;
}

/** Adds signed cents to columns of the FY row (CI upsertInSalaryBreakup, one statement instead of one per column). */
export async function addToSalaryBreakup(tx: Tx, emp: number, fy: number, delta: BreakupDelta, actor: number, sign: 1 | -1 = 1) {
  const cols = await columnsOf('salary_breakup');
  const sets: string[] = [];
  const params: unknown[] = [emp, fy, actor];
  for (const [key, cents] of Object.entries(delta)) {
    if (!cents) continue;
    const col = cols.get(key.toUpperCase());
    if (!col) throw new Error(`salary_breakup has no column ${key}.`);
    params.push(centsText(sign * cents));
    sets.push(`"${col.name}" = COALESCE("${col.name}", 0) + $${params.length}::numeric`);
  }
  if (!sets.length) return;
  await tx.$executeRawUnsafe(
    `UPDATE salary_breakup SET ${sets.join(', ')}, "UPDATED_BY" = $3::int, "UPDATED_ON" = now()
     WHERE "SLB_ID" = (SELECT "SLB_ID" FROM salary_breakup WHERE "EMP_ID" = $1::int AND "YEAR" = $2::int ORDER BY "SLB_ID" LIMIT 1)`,
    ...params,
  );
}

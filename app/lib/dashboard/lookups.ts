/**
 * lib/dashboard/lookups.ts
 *
 * Port of `indp_mst_data_m->getMasterIDFromCode($code)`, used throughout the
 * legacy dashboard models to resolve status codes (e.g. "EMSC" = current
 * employee status, "EMSF" = former, "PROB" = probation) to the numeric
 * `independent_mst.MSTR_ID` that the actual data rows reference.
 *
 * Results are cached per request-context call since these codes never change
 * at runtime — avoids re-querying independent_mst for every widget.
 */
import { queryOne } from './db';

const codeCache = new Map<string, number | null>();

export async function getMasterIdFromCode(code: string): Promise<number | null> {
  if (codeCache.has(code)) {
    return codeCache.get(code)!;
  }

  const row = await queryOne<{ MSTR_ID: number }>(
    `SELECT "MSTR_ID" FROM "independent_mst" WHERE "MSTR_CD" = $1 AND "IS_DELETED" = false LIMIT 1`,
    [code]
  );

  const id = row ? row.MSTR_ID : null;
  codeCache.set(code, id);
  return id;
}

/** Well-known master codes used by the Employee Dashboard (from dashboard_employee_m.php). */
export const EMPLOYEE_STATUS_CODES = {
  CURRENT: 'EMSC',
  FORMER: 'EMSF',
  PROBATION: 'PROB',
} as const;

/** Leave type codes used by the Leave Dashboard (from dashboard_leave.php's controller lookups). */
export const LEAVE_TYPE_CODES = {
  PAID: 'LTPL',
  UNPAID: 'ATTCODUL',
  SICK: 'LTSL',
  LIEU: 'LTLD',
} as const;

/** Timesheet status codes used by the Timesheet Dashboard (from dashboard_timesheet_m.php). */
export const TIMESHEET_STATUS_CODES = {
  APPROVED: 'APR',
  PENDING_APPROVAL: 'APPN',
  REJECTED: 'RJT',
  DRAFTED: 'DRFT',
} as const;

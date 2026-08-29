/**
 * lib/dashboard/queries/timesheet.ts
 *
 * Port of the subset of dashboardModel/dashboard/dashboard_timesheet_m.php
 * that backs components/dashboard/TimesheetDashboard.tsx: the four
 * approved/pending/rejected/drafted KPI counts (current month), and the
 * five "fill rate" percentage cards (Today / Yesterday / Current Week /
 * Last Week / Current Month).
 *
 * Table assumption (from the literal PHP queries):
 *   - timesheet (TS_STATUS_ID, TS_DATE, OA_BRAND_ID, IS_DELETED)
 *
 * NOTE on fill-rate normalization: the original PHP's Fill/NotFill pair for
 * "Current Month" is internally inconsistent (getFillingTimeSheetCurrentMonth
 * checks MONTH(TS_DATE) = current, but getNotFillingTimeCurrentMonth checks
 * MONTH(TS_DATE) != current — i.e. it doesn't actually mean "not filled this
 * month", it means "drafted in some other month"). Porting that literally
 * would produce a nonsensical percentage. Instead, for every period, this
 * file consistently defines:
 *   filled     = TS_STATUS_ID IN (APR, APPN)   within the period
 *   not filled = TS_STATUS_ID = DRFT           within the same period
 * which matches the *intent* of every fill-rate card (locked-in vs.
 * still-drafted for that period) and is what services/timesheetDashboardService.ts
 * turns into a percentage.
 */
import { queryOne } from '../db';
import { DashboardContext, shouldScopeToBrand } from '../context';

export type TimesheetPeriod = 'today' | 'yesterday' | 'currentWeek' | 'lastWeek' | 'currentMonth';

function periodPredicate(period: TimesheetPeriod, column = 'TS_DATE'): string {
  switch (period) {
    case 'today':
      return `"${column}" = CURRENT_DATE`;
    case 'yesterday':
      return `"${column}" = CURRENT_DATE - INTERVAL '1 day'`;
    case 'currentWeek':
      return `DATE_TRUNC('week', "${column}") = DATE_TRUNC('week', CURRENT_DATE)`;
    case 'lastWeek':
      return `DATE_TRUNC('week', "${column}") = DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days')`;
    case 'currentMonth':
      return `EXTRACT(MONTH FROM "${column}") = EXTRACT(MONTH FROM CURRENT_DATE)
               AND EXTRACT(YEAR FROM "${column}") = EXTRACT(YEAR FROM CURRENT_DATE)`;
  }
}

async function countByStatus(
  ctx: DashboardContext,
  statusIds: number[],
  period: TimesheetPeriod
): Promise<number> {
  const params: any[] = [...statusIds];
  const placeholders = statusIds.map((_, i) => `$${i + 1}`).join(', ');
  let where = `"TS_STATUS_ID" IN (${placeholders}) AND "IS_DELETED" = 0 AND ${periodPredicate(period)}`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND "OA_BRAND_ID" = $${params.length}`;
  }
  const row = await queryOne<{ count: string }>(`SELECT COUNT(*) AS count FROM "timesheet" WHERE ${where}`, params);
  return row ? Number(row.count) : 0;
}

/** getPendingRequest/getApproved/getTotalRejected/getTotalDraffted() — current-month KPI counts. */
export async function getTimesheetStatusKpis(
  ctx: DashboardContext,
  codes: { approved: number; pendingApproval: number; rejected: number; drafted: number }
): Promise<{ approved: number; pending: number; rejected: number; drafted: number }> {
  const [approved, pending, rejected, drafted] = await Promise.all([
    countByStatus(ctx, [codes.approved], 'currentMonth'),
    countByStatus(ctx, [codes.pendingApproval], 'currentMonth'),
    countByStatus(ctx, [codes.rejected], 'currentMonth'),
    countByStatus(ctx, [codes.drafted], 'currentMonth'),
  ]);
  return { approved, pending, rejected, drafted };
}

/** Fill-rate pair (filled vs. still-drafted) for a given period — see module docblock. */
export async function getFillRate(
  ctx: DashboardContext,
  codes: { approved: number; pendingApproval: number; drafted: number },
  period: TimesheetPeriod
): Promise<{ filled: number; total: number }> {
  const [filled, drafted] = await Promise.all([
    countByStatus(ctx, [codes.approved, codes.pendingApproval], period),
    countByStatus(ctx, [codes.drafted], period),
  ]);
  return { filled, total: filled + drafted };
}

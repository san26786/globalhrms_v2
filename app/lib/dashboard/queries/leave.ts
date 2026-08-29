/**
 * lib/dashboard/queries/leave.ts
 *
 * Port of the subset of dashboardModel/dashboard/dashboard_leave_m.php that
 * backs components/dashboard/LeaveDashboard.tsx: today's paid/unpaid/sick/
 * lieu KPI counts, and the top-5-employees-this-month leaderboards for paid,
 * unpaid, and sick leave (the UI has no "top lieu" widget, matching the PHP
 * controller which also never wires getCurrentMonthLieuLE — there isn't one).
 *
 * Table assumptions (from the literal PHP queries, and confirmed column
 * names for leave_request_pending_vw / its parent leave_request_vw you
 * shared):
 *   - leave_request_vw   (LEAVE_TYPE_ID, IS_DELETED, START_DATE, END_DATE,
 *                          OABRANDID, EMP_ID, EMP_NM, LEAVES_APPLIED)
 *   - emp_mst            (REF_EMP_ID, EMP_STATUS_ID) — joined via
 *                          emp_mst.REF_EMP_ID = leave_request_vw.EMP_ID
 */
import { queryOne, queryMany } from '../db';
import { DashboardContext, shouldScopeToBrand } from '../context';
import { LeaveLeaderboardRow } from '../types';

/** getTodayPaidLeave/UnpaidLeave/SickLeave/LieuLeave() — count active leave spanning today. */
export async function getTodayLeaveCount(ctx: DashboardContext, leaveTypeId: number): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const params: any[] = [leaveTypeId, today, today];
  let where = `"LEAVE_TYPE_ID" = $1 AND "IS_DELETED" = 0 AND "START_DATE" <= $2 AND "END_DATE" >= $3`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND "OABRANDID" = $${params.length}`;
  }
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "leave_request_vw" WHERE ${where}`,
    params
  );
  return row ? Number(row.count) : 0;
}

/** getCurrentMonthPaidLE/UnpaidLE/SickLE() — top 5 current employees by leave count this month. */
export async function getTopLeaveEmployeesThisMonth(
  ctx: DashboardContext,
  leaveTypeId: number,
  currentEmpStatusId: number
): Promise<LeaveLeaderboardRow[]> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const params: any[] = [leaveTypeId, currentEmpStatusId, month, year];
  let where = `lr."LEAVE_TYPE_ID" = $1
               AND lr."IS_DELETED" = 0
               AND em."EMP_STATUS_ID" = $2
               AND EXTRACT(MONTH FROM lr."START_DATE") = $3
               AND EXTRACT(YEAR FROM lr."START_DATE") = $4`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND lr."OABRANDID" = $${params.length}`;
  }
  const rows = await queryMany<{ EMP_NM: string; leaves_applied: string }>(
    `SELECT lr."EMP_NM" AS "EMP_NM", COUNT(lr."LEAVES_APPLIED") AS leaves_applied
     FROM "leave_request_vw" lr
     JOIN "emp_mst" em ON em."REF_EMP_ID" = lr."EMP_ID"
     WHERE ${where}
     GROUP BY lr."EMP_NM"
     ORDER BY leaves_applied DESC
     LIMIT 5`,
    params
  );
  return rows.map((r) => ({ name: r.EMP_NM, count: Number(r.leaves_applied) }));
}

/**
 * lib/dashboard/queries/attendance.ts
 *
 * Port of the subset of dashboardModel/dashboard/dashboard_attendance_m.php
 * that backs the widgets actually rendered by components/dashboard/
 * AttendanceDashboard.tsx: today's present/absent/early-going/late-entry
 * KPIs, the top-5 leaderboards for the current month, and a 7-day early
 * going tally.
 *
 * Table assumptions (from the literal PHP queries — not yet confirmed
 * against a shared Prisma model, same caveat as job_mst_vw etc. in
 * queries/employee.ts):
 *   - attendance_register       (EMP_ID, EMP_STATUS_ID, OA_BRAND_ID, IS_DELETED,
 *                                 MONTH, YEAR, "DAY1".."DAY31" holding 'P'|'A'|'EG'|'LE',
 *                                 NO_OF_PRESENT, NO_OF_ABSENT, NO_OF_HALF_DAY)
 *   - attendance_employee_vw    (ATTND_EMP_ID, IMP_EMP_NAME) — joined via
 *                                 attendance_employee_vw.ATTND_EMP_ID = attendance_register.EMP_ID
 *
 * NOTE: "DAY{n}" is a per-day pivoted column, so the column name is
 * interpolated (never user input — always a computed 1-31 day-of-month
 * integer) rather than parameterized, since Postgres can't bind identifiers.
 */
import { queryOne, queryMany } from '../db';
import { DashboardContext, shouldScopeToBrand } from '../context';
import { AttendanceLeaderboardRow } from '../types';

type DayStatus = 'P' | 'A' | 'EG' | 'LE';

function dayColumn(dayOfMonth: number): string {
  // Defensive clamp — this always comes from Date computations, never user input.
  const day = Math.min(31, Math.max(1, Math.round(dayOfMonth)));
  return `"DAY${day}"`;
}

/** Shared WHERE builder for "today" style KPI counts (getTodayPresent/Absent/EarlyGoing/LateEntry). */
async function countTodayByStatus(
  ctx: DashboardContext,
  currentMstrId: number,
  status: DayStatus,
  dayOfMonth: number,
  month: number,
  year: number
): Promise<number> {
  const params: any[] = [month, year, currentMstrId];
  let where = `ar."MONTH" = $1 AND ar."YEAR" = $2 AND ar."EMP_STATUS_ID" = $3 AND ar."IS_DELETED" = 0 AND ar.${dayColumn(
    dayOfMonth
  )} = '${status}'`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND ar."OA_BRAND_ID" = $${params.length}`;
  }
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM "attendance_register" ar
     JOIN "attendance_employee_vw" ae ON ae."ATTND_EMP_ID" = ar."EMP_ID"
     WHERE ${where}`,
    params
  );
  return row ? Number(row.count) : 0;
}

export async function getTodayAttendanceKpis(
  ctx: DashboardContext,
  currentMstrId: number
): Promise<{ present: number; absent: number; earlyGoing: number; lateEntry: number }> {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [present, absent, earlyGoing, lateEntry] = await Promise.all([
    countTodayByStatus(ctx, currentMstrId, 'P', dayOfMonth, month, year),
    countTodayByStatus(ctx, currentMstrId, 'A', dayOfMonth, month, year),
    countTodayByStatus(ctx, currentMstrId, 'EG', dayOfMonth, month, year),
    countTodayByStatus(ctx, currentMstrId, 'LE', dayOfMonth, month, year),
  ]);

  return { present, absent, earlyGoing, lateEntry };
}

/**
 * getTopEmployeeP/A/H() — top 5 employees this month by NO_OF_PRESENT /
 * NO_OF_ABSENT / NO_OF_HALF_DAY.
 */
async function getTopByColumn(
  ctx: DashboardContext,
  currentMstrId: number,
  column: 'NO_OF_PRESENT' | 'NO_OF_ABSENT' | 'NO_OF_HALF_DAY'
): Promise<AttendanceLeaderboardRow[]> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const params: any[] = [month, year, currentMstrId];
  let where = `ar."MONTH" = $1 AND ar."YEAR" = $2 AND ar."EMP_STATUS_ID" = $3`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND ar."OA_BRAND_ID" = $${params.length}`;
  }
  const rows = await queryMany<{ IMP_EMP_NAME: string; value: string }>(
    `SELECT ae."IMP_EMP_NAME" AS "IMP_EMP_NAME", ar."${column}" AS value
     FROM "attendance_register" ar
     JOIN "attendance_employee_vw" ae ON ae."ATTND_EMP_ID" = ar."EMP_ID"
     WHERE ${where}
     ORDER BY ar."${column}" DESC
     LIMIT 5`,
    params
  );
  return rows.map((r) => ({ name: r.IMP_EMP_NAME, count: Number(r.value) }));
}

export const getTopPresentEmployees = (ctx: DashboardContext, currentMstrId: number) =>
  getTopByColumn(ctx, currentMstrId, 'NO_OF_PRESENT');

export const getTopAbsentEmployees = (ctx: DashboardContext, currentMstrId: number) =>
  getTopByColumn(ctx, currentMstrId, 'NO_OF_ABSENT');

export const getTopHalfDayEmployees = (ctx: DashboardContext, currentMstrId: number) =>
  getTopByColumn(ctx, currentMstrId, 'NO_OF_HALF_DAY');

/**
 * Extension beyond the literal PHP port: dashboard_attendance_m.php's
 * get7dayEarlyGoing() only returns a single aggregate count (matching a KPI
 * tile), but the existing UI's "Early Going - Last 7 Days" widget is a
 * per-employee leaderboard. This generalizes the same UNION-ALL-over-days
 * approach the PHP used, grouping by employee instead of just counting rows,
 * to produce the leaderboard the UI actually needs.
 */
export async function getEarlyGoingLast7Days(
  ctx: DashboardContext,
  currentMstrId: number
): Promise<AttendanceLeaderboardRow[]> {
  const today = new Date();
  const dayQueries: string[] = [];
  const params: any[] = [];

  for (let i = 0; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();

    params.push(month, year, currentMstrId);
    const monthIdx = params.length - 2;
    const yearIdx = params.length - 1;
    const statusIdx = params.length;

    let clause = `SELECT ae."IMP_EMP_NAME" AS name
       FROM "attendance_register" ar
       JOIN "attendance_employee_vw" ae ON ae."ATTND_EMP_ID" = ar."EMP_ID"
       WHERE ar.${dayColumn(day)} = 'EG'
         AND ar."MONTH" = $${monthIdx}
         AND ar."YEAR" = $${yearIdx}
         AND ar."EMP_STATUS_ID" = $${statusIdx}
         AND ar."IS_DELETED" = 0`;

    if (shouldScopeToBrand(ctx)) {
      params.push(ctx.oaBrandId);
      clause += ` AND ar."OA_BRAND_ID" = $${params.length}`;
    }
    dayQueries.push(clause);
  }

  const rows = await queryMany<{ name: string }>(dayQueries.join(' UNION ALL '), params);

  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r.name, (counts.get(r.name) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

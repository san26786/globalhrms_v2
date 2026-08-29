/**
 * lib/dashboard/queries/employee.ts
 *
 * Direct port of dashboardModel/dashboard/dashboard_employee_m.php.
 * Each function here mirrors one method from the PHP model, translated from
 * CodeIgniter's Active Record + MySQL to parameterized Postgres via
 * lib/dashboard/db.ts.
 *
 * Table/view assumptions (confirmed against the Prisma models / MySQL view
 * definitions you shared):
 *   - emp_mst              (EMP_ID, EMP_STATUS_ID, GENDER_ID, OA_BRAND_ID, IS_DELETED, ...)
 *   - job_mst               (EMP_ID, EMP_STATUS_ID, EMP_GROSS_SALARY, DATE_OF_JOINING, OA_BRAND_ID, IS_DELETED, ...)
 *   - independent_mst      (MSTR_ID, MSTR_CD, MSTR_NM, IS_DELETED)
 *   - job_mst_vw            (view over job_mst; exposes EMP_ID, DEPARTMENT_NAME, DATE_OF_JOINING, OABRANDID, IS_DELETED)
 *   - emp_manager_new_vw    (view over emp_mst; exposes EMP_STATUS_ID, OABRANDID, IS_DELETED)
 *   - emp_termination_dtl   (EMP_TERMINATION_ID, TERMINATION_DATE, OA_BRAND_ID, IS_DELETED)
 *   - leave_request_pending_vw (already pre-filtered to LEAVE_STATUS_CD = 'LEPE' upstream;
 *                                exposes EMP_NM, LEAVE_REQUEST_ID, DATE_APPLIED, LEAVE_REASON, OABRANDID)
 *
 * All of these are assumed to exist with identical column names in the target
 * Postgres database (same names as your MySQL views/Prisma models). If any of
 * them differ once migrated, only this file needs to change — services and
 * the API route are insulated from the raw SQL.
 */
import { queryOne, queryMany } from '../db';
import { DashboardContext, shouldScopeToBrand } from '../context';
import { NamedCount, DonutSegment, SalarySlab, JoiningTrendPoint, PendingLeaveRow } from '../types';

// Re-export for callers that only need the guard, not the whole context module.
export { shouldScopeToBrand };

/** getAllRegisteredEmployeeCount() */
export async function getAllRegisteredEmployeeCount(ctx: DashboardContext): Promise<number> {
  const params: any[] = [];
  let where = `"IS_DELETED" = 0`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND "OA_BRAND_ID" = $${params.length}`;
  }
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "emp_mst" WHERE ${where}`,
    params
  );
  return row ? Number(row.count) : 0;
}

/** getCurrentEmployeeCount() — via emp_manager_new_vw */
export async function getCurrentEmployeeCount(ctx: DashboardContext, currentMstrId: number): Promise<number> {
  const params: any[] = [currentMstrId];
  let where = `"EMP_STATUS_ID" = $1 AND "IS_DELETED" = 0`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND "OABRANDID" = $${params.length}`;
  }
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "emp_manager_new_vw" WHERE ${where}`,
    params
  );
  return row ? Number(row.count) : 0;
}

/** getFormerEmployeeCount() — via emp_manager_new_vw */
export async function getFormerEmployeeCount(ctx: DashboardContext, formerMstrId: number): Promise<number> {
  const params: any[] = [formerMstrId];
  let where = `"EMP_STATUS_ID" = $1 AND "IS_DELETED" = 0`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND "OABRANDID" = $${params.length}`;
  }
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "emp_manager_new_vw" WHERE ${where}`,
    params
  );
  return row ? Number(row.count) : 0;
}

/** getProbationEmployee() — via job_mst */
export async function getProbationEmployeeCount(ctx: DashboardContext, probationMstrId: number): Promise<number> {
  const params: any[] = [probationMstrId];
  let where = `"EMP_STATUS_ID" = $1 AND "IS_DELETED" = 0`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND "OA_BRAND_ID" = $${params.length}`;
  }
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "job_mst" WHERE ${where}`,
    params
  );
  return row ? Number(row.count) : 0;
}

/** getCurrentMonthRegisteredEmployee() — via job_mst, current calendar month */
export async function getCurrentMonthRegisteredEmployeeCount(ctx: DashboardContext): Promise<number> {
  const params: any[] = [];
  let where = `EXTRACT(MONTH FROM "DATE_OF_JOINING") = EXTRACT(MONTH FROM CURRENT_DATE)
               AND EXTRACT(YEAR FROM "DATE_OF_JOINING") = EXTRACT(YEAR FROM CURRENT_DATE)`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND "OA_BRAND_ID" = $${params.length}`;
  }
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "job_mst" WHERE ${where}`,
    params
  );
  return row ? Number(row.count) : 0;
}

/** getResignationEmployee() — via emp_termination_dtl, current calendar month */
export async function getResignationEmployeeCount(ctx: DashboardContext): Promise<number> {
  const params: any[] = [];
  let where = `"EMP_TERMINATION_ID" IS NOT NULL
               AND EXTRACT(MONTH FROM "TERMINATION_DATE") = EXTRACT(MONTH FROM CURRENT_DATE)
               AND EXTRACT(YEAR FROM "TERMINATION_DATE") = EXTRACT(YEAR FROM CURRENT_DATE)
               AND "IS_DELETED" = 0`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND "OA_BRAND_ID" = $${params.length}`;
  }
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "emp_termination_dtl" WHERE ${where}`,
    params
  );
  return row ? Number(row.count) : 0;
}

/** getGender() — current employees only, grouped by GENDER_ID → independent_mst.MSTR_NM */
export async function getGenderSplit(ctx: DashboardContext, currentMstrId: number): Promise<NamedCount[]> {
  const params: any[] = [currentMstrId];
  let where = `em."EMP_STATUS_ID" = $1
               AND em."GENDER_ID" IS NOT NULL
               AND em."IS_DELETED" = 0
               AND im."IS_DELETED" = false`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND em."OA_BRAND_ID" = $${params.length}`;
  }
  const rows = await queryMany<{ gender: string; total: string }>(
    `SELECT im."MSTR_NM" AS gender, COUNT(em."GENDER_ID") AS total
     FROM "emp_mst" em
     JOIN "independent_mst" im ON im."MSTR_ID" = em."GENDER_ID"
     WHERE ${where}
     GROUP BY im."MSTR_NM"`,
    params
  );
  return rows.map((r) => ({ name: r.gender, count: Number(r.total) }));
}

/** getTotalEmployee() — all employees (any status), grouped by EMP_STATUS_ID → independent_mst.MSTR_NM */
export async function getEmployeeStatusBreakdown(ctx: DashboardContext): Promise<NamedCount[]> {
  const params: any[] = [];
  let where = `em."EMP_STATUS_ID" IS NOT NULL
               AND em."IS_DELETED" = 0
               AND im."IS_DELETED" = false`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND em."OA_BRAND_ID" = $${params.length}`;
  }
  const rows = await queryMany<{ emp_status: string; total_emp: string }>(
    `SELECT im."MSTR_NM" AS emp_status, COUNT(em."EMP_STATUS_ID") AS total_emp
     FROM "emp_mst" em
     JOIN "independent_mst" im ON im."MSTR_ID" = em."EMP_STATUS_ID"
     WHERE ${where}
     GROUP BY im."MSTR_NM"`,
    params
  );
  return rows.map((r) => ({ name: r.emp_status, count: Number(r.total_emp) }));
}

/** getTotalEmployeeByDepartment() — via job_mst_vw joined to emp_mst, current employees only */
export async function getEmployeeCountByDepartment(
  ctx: DashboardContext,
  currentMstrId: number
): Promise<Omit<DonutSegment, 'percentage' | 'color'>[]> {
  const params: any[] = [currentMstrId];
  let where = `v."DEPARTMENT_NAME" IS NOT NULL
               AND v."IS_DELETED" = 0
               AND em."EMP_STATUS_ID" = $1`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND v."OABRANDID" = $${params.length}`;
  }
  const rows = await queryMany<{ department_name: string; staff_count: string }>(
    `SELECT v."DEPARTMENT_NAME" AS department_name, COUNT(v."DEPARTMENT_NAME") AS staff_count
     FROM "job_mst_vw" v
     JOIN "emp_mst" em ON em."EMP_ID" = v."EMP_ID"
     WHERE ${where}
     GROUP BY v."DEPARTMENT_NAME"`,
    params
  );
  return rows.map((r) => ({ department: r.department_name, count: Number(r.staff_count) }));
}

/** getTotalYear() — via job_mst_vw, joining trend by DATE_OF_JOINING year */
export async function getJoiningTrendByYear(ctx: DashboardContext): Promise<JoiningTrendPoint[]> {
  const params: any[] = [];
  let where = `"DATE_OF_JOINING" IS NOT NULL AND "IS_DELETED" = 0`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND "OABRANDID" = $${params.length}`;
  }
  const rows = await queryMany<{ year_of_joining: string; staff_count: string }>(
    `SELECT EXTRACT(YEAR FROM "DATE_OF_JOINING") AS year_of_joining, COUNT(*) AS staff_count
     FROM "job_mst_vw"
     WHERE ${where}
     GROUP BY EXTRACT(YEAR FROM "DATE_OF_JOINING")
     ORDER BY year_of_joining ASC`,
    params
  );
  return rows
    .filter((r) => r.year_of_joining !== null && Number(r.year_of_joining) !== 0)
    .map((r) => ({ year: Number(r.year_of_joining), count: Number(r.staff_count) }));
}

/**
 * getTotalSalary() — banded counts of EMP_GROSS_SALARY for current employees,
 * via job_mst joined to emp_mst. Bands match the original PHP exactly.
 */
const SALARY_BANDS: { range: string; min: number; max: number }[] = [
  { range: '10,000 - 100,000', min: 10000, max: 100000 },
  { range: '100,001 - 200,000', min: 100001, max: 200000 },
  { range: '200,001 - 300,000', min: 200001, max: 300000 },
  { range: '300,001 - 400,000', min: 300001, max: 400000 },
  { range: '400,001 - 500,000', min: 400001, max: 500000 },
  { range: '500,001 - 600,000', min: 500001, max: 600000 },
  { range: '600,001 - 700,000', min: 600001, max: 700000 },
];

export async function getSalarySlabCounts(ctx: DashboardContext, currentMstrId: number): Promise<SalarySlab[]> {
  const params: any[] = [currentMstrId];
  let brandClause = '';
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    brandClause = ` AND jm."OA_BRAND_ID" = $${params.length}`;
  }

  const caseExprs = SALARY_BANDS.map(
    (b, i) =>
      `COUNT(CASE WHEN jm."EMP_GROSS_SALARY" BETWEEN ${b.min} AND ${b.max} THEN jm."EMP_GROSS_SALARY" END) AS range_salary${i + 1}`
  ).join(',\n        ');

  const row = await queryOne<Record<string, string>>(
    `SELECT
        ${caseExprs}
     FROM "job_mst" jm
     JOIN "emp_mst" em ON em."EMP_ID" = jm."EMP_ID"
     WHERE jm."IS_DELETED" = 0 AND em."EMP_STATUS_ID" = $1${brandClause}`,
    params
  );

  if (!row) return SALARY_BANDS.map((b) => ({ range: b.range, count: 0 }));

  return SALARY_BANDS.map((b, i) => ({
    range: b.range,
    count: Number(row[`range_salary${i + 1}`] ?? 0),
  }));
}

/** getLeaveReason() — pending leave applied this calendar month, via leave_request_pending_vw */
export async function getPendingLeaveThisMonth(ctx: DashboardContext): Promise<PendingLeaveRow[]> {
  const params: any[] = [];
  let where = `EXTRACT(MONTH FROM "DATE_APPLIED") = EXTRACT(MONTH FROM CURRENT_DATE)
               AND EXTRACT(YEAR FROM "DATE_APPLIED") = EXTRACT(YEAR FROM CURRENT_DATE)`;
  if (shouldScopeToBrand(ctx)) {
    params.push(ctx.oaBrandId);
    where += ` AND "OABRANDID" = $${params.length}`;
  }
  const rows = await queryMany<{
    EMP_NM: string;
    LEAVE_REQUEST_ID: number;
    DATE_APPLIED: string;
    LEAVE_REASON: string;
  }>(
    `SELECT "EMP_NM", "LEAVE_REQUEST_ID", "DATE_APPLIED", "LEAVE_REASON"
     FROM "leave_request_pending_vw"
     WHERE ${where}
     ORDER BY "DATE_APPLIED" ASC`,
    params
  );
  return rows.map((r) => ({
    leaveRequestId: r.LEAVE_REQUEST_ID,
    employeeName: r.EMP_NM,
    reason: r.LEAVE_REASON,
    dateApplied: r.DATE_APPLIED,
  }));
}

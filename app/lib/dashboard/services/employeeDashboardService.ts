/**
 * lib/dashboard/services/employeeDashboardService.ts
 *
 * Business-logic layer for the Employee Dashboard. Ports the aggregation
 * that used to happen partly in dashboard_employee.php (controller) and
 * partly inline in dashboard_employee_v.php (view) — e.g. the legacy view
 * computed gender/status percentages itself before drawing the donut chart.
 * That derivation now lives here so it's testable and shared between the
 * API route and (if needed later) server components.
 */
import { getDashboardContext } from '../context';
import { getMasterIdFromCode, EMPLOYEE_STATUS_CODES } from '../lookups';
import {
  getAllRegisteredEmployeeCount,
  getCurrentEmployeeCount,
  getFormerEmployeeCount,
  getProbationEmployeeCount,
  getCurrentMonthRegisteredEmployeeCount,
  getResignationEmployeeCount,
  getGenderSplit,
  getEmployeeStatusBreakdown,
  getEmployeeCountByDepartment,
  getJoiningTrendByYear,
  getSalarySlabCounts,
  getPendingLeaveThisMonth,
} from '../queries/employee';
import { DonutSegment, EmployeeDashboardData } from '../types';

/** Stable palette so department colors don't jump between refreshes; cycles if > length. */
const DEPARTMENT_PALETTE = [
  '#2563eb', '#f97316', '#ef4444', '#10b981', '#8b5cf6',
  '#f59e0b', '#06b6d4', '#ec4899', '#84cc16', '#64748b',
];

function withPercentagesAndColors(
  rows: { department: string; count: number }[]
): DonutSegment[] {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return rows.map((r, i) => ({
    department: r.department,
    count: r.count,
    percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
    color: DEPARTMENT_PALETTE[i % DEPARTMENT_PALETTE.length],
  }));
}

export async function getEmployeeDashboardData(): Promise<EmployeeDashboardData> {
  const ctx = await getDashboardContext();

  const [currentMstrId, formerMstrId, probationMstrId] = await Promise.all([
    getMasterIdFromCode(EMPLOYEE_STATUS_CODES.CURRENT),
    getMasterIdFromCode(EMPLOYEE_STATUS_CODES.FORMER),
    getMasterIdFromCode(EMPLOYEE_STATUS_CODES.PROBATION),
  ]);

  const [
    totalRegistered,
    totalCurrent,
    totalFormer,
    totalProbation,
    registeredThisMonth,
    resignedThisMonth,
    genderSplit,
    employeeStatus,
    departmentRows,
    salarySlabs,
    joiningTrend,
    pendingLeave,
  ] = await Promise.all([
    getAllRegisteredEmployeeCount(ctx),
    currentMstrId ? getCurrentEmployeeCount(ctx, currentMstrId) : Promise.resolve(0),
    formerMstrId ? getFormerEmployeeCount(ctx, formerMstrId) : Promise.resolve(0),
    probationMstrId ? getProbationEmployeeCount(ctx, probationMstrId) : Promise.resolve(0),
    getCurrentMonthRegisteredEmployeeCount(ctx),
    getResignationEmployeeCount(ctx),
    currentMstrId ? getGenderSplit(ctx, currentMstrId) : Promise.resolve([]),
    getEmployeeStatusBreakdown(ctx),
    currentMstrId ? getEmployeeCountByDepartment(ctx, currentMstrId) : Promise.resolve([]),
    currentMstrId ? getSalarySlabCounts(ctx, currentMstrId) : Promise.resolve([]),
    getJoiningTrendByYear(ctx),
    getPendingLeaveThisMonth(ctx),
  ]);

  return {
    kpis: {
      totalRegistered,
      totalCurrent,
      totalFormer,
      totalProbation,
      registeredThisMonth,
      resignedThisMonth,
    },
    genderSplit,
    employeeStatus,
    departmentEngagement: withPercentagesAndColors(departmentRows),
    salarySlabs,
    joiningTrend,
    pendingLeave,
  };
}

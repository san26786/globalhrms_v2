/**
 * lib/dashboard/services/leaveDashboardService.ts
 */
import { DashboardContext } from '../context';
import { getMasterIdFromCode, EMPLOYEE_STATUS_CODES, LEAVE_TYPE_CODES } from '../lookups';
import { getTodayLeaveCount, getTopLeaveEmployeesThisMonth } from '../queries/leave';
import { LeaveDashboardData } from '../types';

export async function getLeaveDashboardData(ctx: DashboardContext): Promise<LeaveDashboardData> {

  const [paidId, unpaidId, sickId, lieuId, currentEmpStatusId] = await Promise.all([
    getMasterIdFromCode(LEAVE_TYPE_CODES.PAID),
    getMasterIdFromCode(LEAVE_TYPE_CODES.UNPAID),
    getMasterIdFromCode(LEAVE_TYPE_CODES.SICK),
    getMasterIdFromCode(LEAVE_TYPE_CODES.LIEU),
    getMasterIdFromCode(EMPLOYEE_STATUS_CODES.CURRENT),
  ]);

  const [paidToday, unpaidToday, sickToday, lieuToday] = await Promise.all([
    paidId ? getTodayLeaveCount(ctx, paidId) : Promise.resolve(0),
    unpaidId ? getTodayLeaveCount(ctx, unpaidId) : Promise.resolve(0),
    sickId ? getTodayLeaveCount(ctx, sickId) : Promise.resolve(0),
    lieuId ? getTodayLeaveCount(ctx, lieuId) : Promise.resolve(0),
  ]);

  const [topPaid, topUnpaid, topSick] = await Promise.all([
    paidId && currentEmpStatusId ? getTopLeaveEmployeesThisMonth(ctx, paidId, currentEmpStatusId) : Promise.resolve([]),
    unpaidId && currentEmpStatusId ? getTopLeaveEmployeesThisMonth(ctx, unpaidId, currentEmpStatusId) : Promise.resolve([]),
    sickId && currentEmpStatusId ? getTopLeaveEmployeesThisMonth(ctx, sickId, currentEmpStatusId) : Promise.resolve([]),
  ]);

  return {
    kpis: { paidToday, unpaidToday, sickToday, lieuToday },
    topPaid,
    topUnpaid,
    topSick,
  };
}

/**
 * lib/dashboard/services/timesheetDashboardService.ts
 */
import { getDashboardContext } from '../context';
import { getMasterIdFromCode, TIMESHEET_STATUS_CODES } from '../lookups';
import { getTimesheetStatusKpis, getFillRate, TimesheetPeriod } from '../queries/timesheet';
import { TimesheetDashboardData, TimesheetFillRate } from '../types';

function toPercentage(filled: number, total: number): number {
  return total > 0 ? Math.round((filled / total) * 1000) / 10 : 0;
}

export async function getTimesheetDashboardData(): Promise<TimesheetDashboardData> {
  const ctx = await getDashboardContext();

  const [approvedId, pendingApprovalId, rejectedId, draftedId] = await Promise.all([
    getMasterIdFromCode(TIMESHEET_STATUS_CODES.APPROVED),
    getMasterIdFromCode(TIMESHEET_STATUS_CODES.PENDING_APPROVAL),
    getMasterIdFromCode(TIMESHEET_STATUS_CODES.REJECTED),
    getMasterIdFromCode(TIMESHEET_STATUS_CODES.DRAFTED),
  ]);

  if (!approvedId || !pendingApprovalId || !rejectedId || !draftedId) {
    // independent_mst hasn't been seeded with the timesheet status codes yet.
    const empty: TimesheetFillRate = { title: '', percentage: 0, filled: 0, total: 0 };
    return {
      kpis: { approved: 0, pending: 0, rejected: 0, drafted: 0 },
      fillRates: {
        today: { ...empty, title: 'Timesheet Today' },
        yesterday: { ...empty, title: 'Timesheet Yesterday' },
        currentWeek: { ...empty, title: 'Timesheet Current Week' },
        lastWeek: { ...empty, title: 'Timesheet Last Week' },
        currentMonth: { ...empty, title: 'Timesheet Current Month' },
      },
    };
  }

  const codes = { approved: approvedId, pendingApproval: pendingApprovalId, rejected: rejectedId, drafted: draftedId };

  const [kpis, today, yesterday, currentWeek, lastWeek, currentMonth] = await Promise.all([
    getTimesheetStatusKpis(ctx, codes),
    getFillRate(ctx, codes, 'today' as TimesheetPeriod),
    getFillRate(ctx, codes, 'yesterday' as TimesheetPeriod),
    getFillRate(ctx, codes, 'currentWeek' as TimesheetPeriod),
    getFillRate(ctx, codes, 'lastWeek' as TimesheetPeriod),
    getFillRate(ctx, codes, 'currentMonth' as TimesheetPeriod),
  ]);

  const buildCard = (title: string, r: { filled: number; total: number }): TimesheetFillRate => ({
    title,
    percentage: toPercentage(r.filled, r.total),
    filled: r.filled,
    total: r.total,
  });

  return {
    kpis,
    fillRates: {
      today: buildCard('Timesheet Today', today),
      yesterday: buildCard('Timesheet Yesterday', yesterday),
      currentWeek: buildCard('Timesheet Current Week', currentWeek),
      lastWeek: buildCard('Timesheet Last Week', lastWeek),
      currentMonth: buildCard('Timesheet Current Month', currentMonth),
    },
  };
}

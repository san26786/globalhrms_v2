/**
 * lib/dashboard/services/attendanceDashboardService.ts
 */
import { DashboardContext } from '../context';
import { getMasterIdFromCode, EMPLOYEE_STATUS_CODES } from '../lookups';
import {
  getTodayAttendanceKpis,
  getTopPresentEmployees,
  getTopAbsentEmployees,
  getTopHalfDayEmployees,
  getEarlyGoingLast7Days,
} from '../queries/attendance';
import { AttendanceDashboardData } from '../types';

export async function getAttendanceDashboardData(ctx: DashboardContext): Promise<AttendanceDashboardData> {
  const currentMstrId = await getMasterIdFromCode(EMPLOYEE_STATUS_CODES.CURRENT);

  if (!currentMstrId) {
    // independent_mst hasn't been seeded with the EMSC code yet — return an empty,
    // well-shaped payload instead of throwing so the UI still renders its empty states.
    return {
      kpis: { presentToday: 0, absentToday: 0, earlyGoingToday: 0, lateEntryToday: 0 },
      topPresent: [],
      topAbsent: [],
      topHalfDays: [],
      earlyGoingLast7Days: [],
    };
  }

  const [kpis, topPresent, topAbsent, topHalfDays, earlyGoingLast7Days] = await Promise.all([
    getTodayAttendanceKpis(ctx, currentMstrId),
    getTopPresentEmployees(ctx, currentMstrId),
    getTopAbsentEmployees(ctx, currentMstrId),
    getTopHalfDayEmployees(ctx, currentMstrId),
    getEarlyGoingLast7Days(ctx, currentMstrId),
  ]);

  return {
    kpis: {
      presentToday: kpis.present,
      absentToday: kpis.absent,
      earlyGoingToday: kpis.earlyGoing,
      lateEntryToday: kpis.lateEntry,
    },
    topPresent,
    topAbsent,
    topHalfDays,
    earlyGoingLast7Days,
  };
}

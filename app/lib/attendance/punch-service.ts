import { prisma } from '@/lib/prisma';
import { headerConfig } from '@/lib/header/headerConfig';
import {
  findAttendanceEmployeeId,
  findOpenRecord,
  getLatestStatusOfDay,
  getPunchStatusIds,
  insertPunchIn,
  updatePunchOut,
} from './punch-repository';
import { resolvePunchClock, type PunchClock } from './punchTime';
import { syncPunchMonitor } from './punchMonitorSync';

export type PunchAction = 'in' | 'out';

export type PunchFailureCode =
  | 'DISABLED'
  | 'NO_ATTENDANCE_EMPLOYEE'
  | 'NO_ACTIVE_BRAND'
  | 'STATUS_MASTER_MISSING'
  | 'ALREADY_PUNCHED_IN'
  | 'NOT_PUNCHED_IN'
  | 'TOO_SOON';

export type PunchResult =
  | { ok: true; isPunchedIn: boolean; message: string }
  | { ok: false; code: PunchFailureCode; message: string };

export interface PunchSnapshot {
  attndEmpId: number;
  isPunchedIn: boolean;
}

export const clockFor = (clientOffsetMinutes?: number | null, now = new Date()): PunchClock =>
  resolvePunchClock(now, { timeZone: headerConfig.punchTimeZone, clientOffsetMinutes });

/**
 * What the header needs to draw the button. null = this user has no attendance-employee row,
 * so there is nothing to punch against (CI would show the button and fail on click).
 * CI get_punch_status_of_day() == 'in'  <=>  latest record of today has status ASPIN
 * (the helper itself was not shared; this mirrors employee_records_m->getPunchStatusOfDay).
 */
export async function getPunchSnapshot(userId: number, clock: PunchClock): Promise<PunchSnapshot | null> {
  const [attndEmpId, ids] = await Promise.all([findAttendanceEmployeeId(userId), getPunchStatusIds()]);
  if (attndEmpId === null || !ids) return null;
  const status = await getLatestStatusOfDay(attndEmpId, clock.dayStart, clock.dayEnd);
  return { attndEmpId, isPunchedIn: status === ids.punchIn };
}

export interface PunchParams {
  action: PunchAction;
  userId: number;
  oaId: number | null;
  oaBrandId: number | null;
  device: string;
  clock: PunchClock;
}

const minutesBetween = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 60_000;

/** Port of employee_records_insert_quick_punchin / employee_records_update_quick_punchout (self punch only). */
export async function punch(params: PunchParams): Promise<PunchResult> {
  const { action, userId, oaId, oaBrandId, clock } = params;

  if (headerConfig.punchMode !== 'interactive') {
    return { ok: false, code: 'DISABLED', message: 'Punching is not enabled.' };
  }
  if (oaBrandId === null) {
    return { ok: false, code: 'NO_ACTIVE_BRAND', message: 'No active brand on your session.' };
  }

  const [attndEmpId, ids] = await Promise.all([findAttendanceEmployeeId(userId), getPunchStatusIds()]);
  if (attndEmpId === null) {
    return {
      ok: false,
      code: 'NO_ATTENDANCE_EMPLOYEE',
      message: 'Could not find your attendance employee id. Please contact your system administrator.',
    };
  }
  if (!ids) {
    return { ok: false, code: 'STATUS_MASTER_MISSING', message: 'Punch statuses (ASPIN/ASPOUT) are not configured.' };
  }

  const result = await prisma.$transaction(async (tx): Promise<PunchResult> => {
    // Serialise punches for one employee so a double click can't create two open records.
    // $executeRaw, not $queryRaw: the function returns `void`, which Prisma can't deserialise as a result set.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${attndEmpId}::bigint)`;

    const status = await getLatestStatusOfDay(attndEmpId, clock.dayStart, clock.dayEnd, tx);

    if (action === 'in') {
      if (status === ids.punchIn) {
        return { ok: false, code: 'ALREADY_PUNCHED_IN', message: 'You are Already Punched IN' };
      }
      await insertPunchIn(
        {
          attndEmpId,
          statusId: ids.punchIn,
          userTime: clock.userTime,
          utcTime: clock.utc,
          offsetSeconds: clock.offsetSeconds,
          device: params.device,
          oaId,
          oaBrandId,
          userId,
        },
        tx
      );
      return { ok: true, isPunchedIn: true, message: 'Punched In Successfully.' };
    }

    // action === 'out'
    if (status !== ids.punchIn) {
      return { ok: false, code: 'NOT_PUNCHED_IN', message: 'Could Not Punch Out.' };
    }
    const open = await findOpenRecord(attndEmpId, tx);
    if (!open) {
      return { ok: false, code: 'NOT_PUNCHED_IN', message: 'Could Not Punch Out.' };
    }

    // CI checkForPunchDiff(): refuse a punch-out too soon after the punch-in.
    const min = headerConfig.punchMinGapMinutes;
    if (min > 0 && open.PUNCH_IN_USER_TIME && minutesBetween(open.PUNCH_IN_USER_TIME, clock.userTime) < min) {
      return {
        ok: false,
        code: 'TOO_SOON',
        message: `Minimum difference between 2 punches should be ${min} minute(s). Please try again later.`,
      };
    }

    await updatePunchOut(
      {
        attndId: open.ATTND_ID,
        statusId: ids.punchOut,
        userTime: clock.userTime,
        utcTime: clock.utc,
        offsetSeconds: clock.offsetSeconds,
        oaId,
        oaBrandId,
        userId,
      },
      tx
    );
    return { ok: true, isPunchedIn: false, message: 'Punched Out Successfully.' };
  });

  if (result.ok) {
    await syncPunchMonitor({ oaBrandId, attndEmpId, userDate: clock.dayStart });
  }
  return result;
}

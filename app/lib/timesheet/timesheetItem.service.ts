import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { anyOf, menuPolicy } from '@/lib/resource/policies';
import { timesheetItemSchema, type TimesheetItemInput } from '@/validations/timesheet.schema';
import { ITEM_SUBMITTED, TIMESHEET_ITEM_MENU, UNIT_HOURS, UNIT_MINUTES } from './timesheet.constants';
import {
  allowedRanges,
  asDate,
  dayOf,
  delayedDeductionEnabled,
  employeeOfUser,
  periodOn,
  statusIds,
} from './timesheet.lookups';
import {
  canEdit,
  ensureTimesheet,
  loadTimesheet,
  recalcActivityDuration,
  roleOf,
  timesheetPolicy,
  type ActionResult,
  type TimesheetRow,
} from './timesheet.service';

/**
 * Timesheet items — CI controllers/timesheet/timesheetItem.php and new_timesheet_item.php
 * (+ models/timesheet/timesheetitem_m.php):
 *  - an item belongs to a timesheet the caller may edit (administrator, or the owner while Draft / Rejected);
 *  - "New Timesheet Item" works by date: the caller's timesheet of that date's period is used, or
 *    created (Pending, CI createTimesheet);
 *  - the date lies in the timesheet's period; with delayed deduction a user may only use allowed
 *    days, a grace day marks the item delayed (DELAY_ENTRY) and the timesheet's DELAYED_COUNT follows;
 *  - two items of a timesheet may not overlap on the same day; the end time may not pass the
 *    employee's punch-out once punched out that day;
 *  - duration and unit come from the times: under an hour in minutes, else hours (CI form script);
 *  - changing an item's end time moves the start of the item that followed it (CI updateNextTimesheetStartTime);
 *  - every change recalculates the timesheet's activity total.
 *
 * Behaviour changes from CI: the punch-out check uses the timesheet owner's attendance (CI used the
 * session user's, wrong when an administrator edits); the delayed-day check reads the delayed
 * deduction setting (CI read the "Activity tab" setting by mistake); the overlap check ignores deleted items.
 */

export const itemPolicy = anyOf(menuPolicy(TIMESHEET_ITEM_MENU), timesheetPolicy);

/** "HH:mm" ⇄ the TIME value Prisma reads and writes (1970-01-01, UTC clock). */
export const toTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
export const fromTime = (d: Date | null | undefined) => (d ? d.toISOString().slice(11, 16) : '');
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const addMinutes = (hhmm: string, minutes: number) => {
  const total = Math.min(23 * 60 + 59, minutesOf(hhmm) + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** CI calculateHrsDifference: under an hour → minutes, else hours with two decimals. */
export async function durationOf(start: string, end: string): Promise<{ duration: number; unitId: number | null; unit: 'minutes' | 'hours' }> {
  const minutes = minutesOf(end) - minutesOf(start);
  const [hoursId, minutesId] = await Promise.all([getMasterId(UNIT_HOURS), getMasterId(UNIT_MINUTES)]);
  if (minutes < 60) return { duration: minutes, unitId: minutesId, unit: 'minutes' };
  return { duration: Math.round((minutes / 60) * 100) / 100, unitId: hoursId, unit: 'hours' };
}

function parseId(raw: string | number, label = 'Timesheet item'): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError(`${label} not found.`);
  return id;
}

/**
 * The timesheet an item is saved to, checked: in scope and still editable by the caller. New
 * Timesheet Item (by date) also accepts the owner's Pending timesheet — CI created those timesheets
 * Pending and kept adding the day's items to them.
 */
async function editableTimesheet(subject: RequestSubject, tsId: number, opts: { pendingOk?: boolean } = {}): Promise<TimesheetRow> {
  const st = await statusIds();
  const row = await loadTimesheet(subject, tsId);
  const role = roleOf(subject, row);
  const ok = canEdit(role, row, st) || (!!opts.pendingOk && role.isOwner && row.TS_STATUS_ID === st.pending);
  if (!ok) throw new ForbiddenError('This timesheet can no longer be edited.');
  return row;
}

/** CI checkEndTimeToPunchOutTime: once punched out that day, the end time may not pass a punch-out. */
async function assertBeforePunchOut(ownerUserId: number | null, day: string, end: string) {
  if (!ownerUserId) return;
  const attendance = await prisma.attendance_employee.findFirst({ where: { REF_EMP_ID: ownerUserId, IS_DELETED: 0 }, select: { ATTND_EMP_ID: true } });
  if (!attendance) return;
  const outStatus = await getMasterId('ASPOUT');
  const [last] = await prisma.$queryRaw<Array<{ status: number | null }>>`
    SELECT "ATTND_STATUS_ID" AS status FROM emp_attendance_record
    WHERE "ATTND_EMP_ID" = ${attendance.ATTND_EMP_ID} AND "IS_DELETED" = 0
      AND (DATE("PUNCH_OUT_USER_TIME") = ${asDate(day)}::date OR DATE("PUNCH_IN_USER_TIME") = ${asDate(day)}::date)
    ORDER BY "PUNCH_IN_USER_TIME" DESC LIMIT 1`;
  if (!last || last.status !== outStatus) return;
  const [ok] = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*) AS n FROM emp_attendance_record
    WHERE "ATTND_EMP_ID" = ${attendance.ATTND_EMP_ID} AND "IS_DELETED" = 0
      AND DATE("PUNCH_IN_USER_TIME") = ${asDate(day)}::date AND "PUNCH_OUT_USER_TIME"::time >= ${`${end}:00`}::time`;
  if (!Number(ok?.n ?? 0)) {
    throw new ValidationError('Timesheet Item End Time is not allow after Punch Out Time', {
      END_TIME: ['Timesheet Item End Time is not allow after Punch Out Time'],
    });
  }
}

/** CI checkExistingEntry: no two items of a timesheet overlap on one day. */
async function assertNoOverlap(tsId: number, day: string, start: string, end: string, exceptId?: number) {
  const clash = await prisma.timesheet_item.findFirst({
    where: {
      TS_ID: tsId,
      IS_DELETED: 0,
      TS_DATE: asDate(day),
      START_TIME: { lt: toTime(end) },
      END_TIME: { gt: toTime(start) },
      ...(exceptId ? { NOT: { TS_ITEM_ID: exceptId } } : {}),
    },
    select: { TS_ITEM_ID: true },
  });
  if (clash) throw new BusinessRuleError('A timesheet item entry already exists for this time period.');
}

/**
 * CI delayed-timesheet date rules: the day lies in the timesheet's period; with delayed deduction a
 * normal user may only use an allowed day — returns whether it is a delayed (grace / granted) day.
 */
async function checkDay(subject: RequestSubject, ts: TimesheetRow, day: string): Promise<boolean> {
  if (day < dayOf(ts.TS_START_DATE) || day > dayOf(ts.TS_END_DATE)) {
    throw new ValidationError('Timesheet Date must be within the timesheet period.', {
      TS_DATE: [`Timesheet Date must be between ${dayOf(ts.TS_START_DATE)} and ${dayOf(ts.TS_END_DATE)}.`],
    });
  }
  if (subject.adminLevel !== 0 || !(await delayedDeductionEnabled(ts.OA_BRAND_ID))) return false;
  const ranges = (await allowedRanges(subject.userId, ts.OA_BRAND_ID)).filter((r) => r.start && r.end && day >= r.start && day <= r.end);
  if (!ranges.length) {
    throw new ValidationError('Timesheet entries are not allowed for this date.', { TS_DATE: ['Timesheet entries are not allowed for this date.'] });
  }
  return ranges.every((r) => r.delayed);
}

/** CI timesheet_m::updateDelayedCount: distinct delayed days of the timesheet. */
async function updateDelayedCount(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], tsId: number) {
  const [row] = await tx.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(DISTINCT "TS_DATE") AS n FROM timesheet_item WHERE "TS_ID" = ${tsId} AND "DELAY_ENTRY" = 1 AND "IS_DELETED" = 0`;
  await tx.timesheet.update({ where: { TS_ID: tsId }, data: { DELAYED_COUNT: Number(row?.n ?? 0) } });
}

/** CI new_timesheet_item: the caller's timesheet of the date's period (created when missing). */
async function timesheetForDay(subject: RequestSubject, day: string): Promise<number> {
  const employee = await employeeOfUser(subject.userId);
  if (!employee?.REF_EMP_ID) {
    throw new BusinessRuleError('Employee information is not synchronised, Please contact business admin to correct this employee info');
  }
  const period = await periodOn(day, employee.OA_BRAND_ID);
  if (!period?.PERIOD_START_DATE || !period.PERIOD_END_DATE) throw new ValidationError('Period Not Found.', { TS_DATE: ['No timesheet period covers this date.'] });
  const st = await statusIds();
  const { TS_ID } = await prisma.$transaction((tx) => ensureTimesheet(tx, subject, employee, period, st));
  return TS_ID;
}

async function loadItem(subject: RequestSubject, rawId: string | number) {
  const item = await prisma.timesheet_item.findFirst({ where: { TS_ITEM_ID: parseId(rawId), IS_DELETED: 0 } });
  if (!item) throw new NotFoundError('Timesheet item not found.');
  const ts = await loadTimesheet(subject, item.TS_ID);
  return { item, ts };
}

export const timesheetItemService = {
  loadItem,
  editableTimesheet,

  /** CI timesheetItem::insert / new_timesheet_item::insert. */
  async create(subject: RequestSubject, body: unknown): Promise<ActionResult & { tsId: number }> {
    if (!(await itemPolicy.check(subject, 'create'))) throw new ForbiddenError();
    const input = timesheetItemSchema.parse(body);
    const byDate = !input.TS_ID;
    const tsId = input.TS_ID || (await timesheetForDay(subject, input.TS_DATE));
    const ts = await editableTimesheet(subject, tsId, { pendingOk: byDate });
    const delayed = await checkDay(subject, ts, input.TS_DATE);
    await Promise.all([
      assertNoOverlap(ts.TS_ID, input.TS_DATE, input.START_TIME, input.END_TIME),
      assertBeforePunchOut(ts.USER_ID, input.TS_DATE, input.END_TIME),
    ]);
    const [{ duration, unitId }, submitted] = await Promise.all([durationOf(input.START_TIME, input.END_TIME), getMasterId(ITEM_SUBMITTED)]);

    await assertInsertSafe('timesheet_item', 'TS_ITEM_ID');
    const now = new Date();
    const id = await prisma.$transaction(async (tx) => {
      const item = await tx.timesheet_item.create({
        data: {
          TS_ID: ts.TS_ID,
          TS_DATE: asDate(input.TS_DATE),
          START_TIME: toTime(input.START_TIME),
          END_TIME: toTime(input.END_TIME),
          DURATION: duration,
          DURATION_UNIT_ID: unitId,
          COMMENT: input.COMMENT,
          TS_PRJ_ID: input.TS_PRJ_ID ?? 0,
          TS_ACTIVITY_ID: input.TS_ACTIVITY_ID ?? null,
          PERIOD_ID: ts.PERIOD_ID,
          ITEM_STATUS: submitted,
          DELAY_ENTRY: delayed ? 1 : 0,
          OA_ID: ts.OA_ID,
          OA_BRAND_ID: ts.OA_BRAND_ID,
          USER_ID: ts.USER_ID,
          CREATED_BY: subject.userId,
          CREATEDON: now,
        },
        select: { TS_ITEM_ID: true },
      });
      await updateDelayedCount(tx, ts.TS_ID);
      await recalcActivityDuration(tx, ts.TS_ID, ts.OA_BRAND_ID);
      return item.TS_ITEM_ID;
    });
    return { id, tsId: ts.TS_ID, message: 'Successfully Added Timesheet Item' };
  },

  /** CI timesheetItem::update: the start time stays; a new end time moves the following item's start. */
  async update(subject: RequestSubject, rawId: string, body: unknown): Promise<ActionResult & { tsId: number }> {
    if (!(await itemPolicy.check(subject, 'update'))) throw new ForbiddenError();
    const input = timesheetItemSchema.parse(body);
    const { item } = await loadItem(subject, rawId);
    const ts = await editableTimesheet(subject, item.TS_ID);
    const start = fromTime(item.START_TIME) || input.START_TIME;
    if (input.END_TIME <= start) throw new ValidationError('End Time must be after Start Time.', { END_TIME: ['End Time must be after Start Time.'] });
    await checkDay(subject, ts, input.TS_DATE);
    await Promise.all([
      assertNoOverlap(ts.TS_ID, input.TS_DATE, start, input.END_TIME, item.TS_ITEM_ID),
      assertBeforePunchOut(ts.USER_ID, input.TS_DATE, input.END_TIME),
    ]);
    const { duration, unitId } = await durationOf(start, input.END_TIME);
    const oldEnd = fromTime(item.END_TIME);

    await prisma.$transaction(async (tx) => {
      if (oldEnd && oldEnd !== input.END_TIME && item.TS_DATE) {
        const next = await tx.timesheet_item.findFirst({
          where: { TS_ID: ts.TS_ID, IS_DELETED: 0, TS_DATE: item.TS_DATE, START_TIME: item.END_TIME, NOT: { TS_ITEM_ID: item.TS_ITEM_ID } },
          select: { TS_ITEM_ID: true, END_TIME: true },
        });
        const nextEnd = fromTime(next?.END_TIME);
        if (next && nextEnd > input.END_TIME) {
          const moved = await durationOf(input.END_TIME, nextEnd);
          await tx.timesheet_item.update({
            where: { TS_ITEM_ID: next.TS_ITEM_ID },
            data: { START_TIME: toTime(input.END_TIME), DURATION: moved.duration, DURATION_UNIT_ID: moved.unitId, UPDATED_BY: subject.userId, UPDATEDON: new Date() },
          });
        }
      }
      await tx.timesheet_item.update({
        where: { TS_ITEM_ID: item.TS_ITEM_ID },
        data: {
          TS_DATE: asDate(input.TS_DATE),
          END_TIME: toTime(input.END_TIME),
          DURATION: duration,
          DURATION_UNIT_ID: unitId,
          COMMENT: input.COMMENT,
          ...(input.TS_PRJ_ID !== undefined ? { TS_PRJ_ID: input.TS_PRJ_ID } : {}),
          ...(input.TS_ACTIVITY_ID !== undefined ? { TS_ACTIVITY_ID: input.TS_ACTIVITY_ID } : {}),
          UPDATED_BY: subject.userId,
          UPDATEDON: new Date(),
        },
      });
      await updateDelayedCount(tx, ts.TS_ID);
      await recalcActivityDuration(tx, ts.TS_ID, ts.OA_BRAND_ID);
    });
    return { id: item.TS_ITEM_ID, tsId: ts.TS_ID, message: 'Successfully Updated Timesheet Item' };
  },

  /** CI timesheetItem::delete: soft delete, then the timesheet's totals. */
  async remove(subject: RequestSubject, rawId: string): Promise<ActionResult & { tsId: number }> {
    if (!(await itemPolicy.check(subject, 'delete'))) throw new ForbiddenError();
    const { item } = await loadItem(subject, rawId);
    const ts = await editableTimesheet(subject, item.TS_ID);
    await prisma.$transaction(async (tx) => {
      await tx.timesheet_item.update({ where: { TS_ITEM_ID: item.TS_ITEM_ID }, data: { IS_DELETED: 1, UPDATED_BY: subject.userId, UPDATEDON: new Date() } });
      await updateDelayedCount(tx, ts.TS_ID);
      await recalcActivityDuration(tx, ts.TS_ID, ts.OA_BRAND_ID);
    });
    return { id: item.TS_ITEM_ID, tsId: ts.TS_ID, message: 'Successfully Deleted Timesheet Item' };
  },

  /** Form helper (CI calculateHrsDifference): duration and unit of two times. */
  async duration(subject: RequestSubject, query: Record<string, string>) {
    if (!(await itemPolicy.check(subject, 'read'))) throw new ForbiddenError();
    const ok = (v: string | undefined) => !!v && /^([01]\d|2[0-3]):[0-5]\d/.test(v);
    if (!ok(query.start) || !ok(query.end) || query.end.slice(0, 5) <= query.start.slice(0, 5)) return { duration: '', unitId: '' };
    const r = await durationOf(query.start.slice(0, 5), query.end.slice(0, 5));
    return { duration: String(r.duration), unitId: r.unitId ?? '' };
  },

  /** Form helper (New Timesheet Item): the period of a date, as CI's read-only "Timesheet Period". */
  async periodOfDay(subject: RequestSubject, day: string) {
    if (!(await itemPolicy.check(subject, 'read'))) throw new ForbiddenError();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '') || !subject.oaBrandId) return { label: '' };
    const period = await periodOn(day, subject.oaBrandId);
    return { label: period?.FISCAL_PERIOD_DESC ?? 'No timesheet period for this date' };
  },
};

export type { TimesheetItemInput };

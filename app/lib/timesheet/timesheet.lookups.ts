import { addDays, format } from 'date-fns';
import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { getMasterCode, getMasterId, getMasterOptionsByTypeCode, type MasterOption } from '@/lib/masters/masterService';
import { resolvePermissionsClassId } from '@/lib/menu/PermissionClass';
import { isYes, settingService, toNumber } from '@/lib/settings/settingService';
import {
  ACTIVITY_TYPE,
  DURATION_UNIT_TYPE,
  EMP_CURRENT,
  MANAGER_CLASS,
  PERIOD_INACTIVE,
  PERIOD_TYPE,
  PROJECT_TYPE,
  SETTING,
  STATUS,
  STATUS_TYPE_CODE,
  type StatusKey,
} from './timesheet.constants';

/**
 * Timesheet lookups — CI timesheet_m / period_mst_m / timesheet_emp_m readers used by the list,
 * the form and the commands. Every query is limited to one brand.
 */

export type StatusIds = Record<StatusKey, number>;

let statusCache: StatusIds | null = null;

/** CI getMasterIDFromCode('DRFT' | 'APPN' | 'APR' | 'RJT') — resolved within the timesheet status type. */
export async function statusIds(): Promise<StatusIds> {
  if (statusCache) return statusCache;
  const type = await prisma.common_type.findFirst({ where: { TYP_CD: STATUS_TYPE_CODE }, select: { TYP_ID: true } });
  const entries = await Promise.all(
    (Object.keys(STATUS) as StatusKey[]).map(async (k) => [k, await getMasterId(STATUS[k], type ? { typeId: type.TYP_ID } : {})] as const),
  );
  const missing = entries.filter(([, id]) => !id).map(([k]) => STATUS[k]);
  if (missing.length) throw new Error(`Timesheet status masters missing: ${missing.join(', ')}`);
  statusCache = Object.fromEntries(entries) as StatusIds;
  return statusCache;
}

export const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
/** A @db.Date column read by Prisma is midnight UTC: its calendar day. */
export const dayOf = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');
/** Calendar day → the Date Prisma writes to a @db.Date column. */
export const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

export interface PeriodRow {
  PERIOD_ID: number;
  PERIOD_START_DATE: Date | null;
  PERIOD_END_DATE: Date | null;
  FISCAL_PERIOD_DESC: string | null;
}

/** CI period_mst_m::getAllNotClosedPeriodDetails(OPTS): the brand's timesheet periods that are not inactive or ended. */
export async function openPeriods(oaBrandId: number): Promise<PeriodRow[]> {
  const [typeId, inactiveId] = await Promise.all([getMasterId(PERIOD_TYPE), getMasterId(PERIOD_INACTIVE)]);
  if (!typeId) return [];
  return prisma.period_mst.findMany({
    where: {
      PERIOD_TYPE_ID: typeId,
      OA_BRAND_ID: oaBrandId,
      PERIOD_ENDED: false,
      IS_DELETED: 0,
      ...(inactiveId ? { OR: [{ PERIOD_STATUS_ID: null }, { PERIOD_STATUS_ID: { not: inactiveId } }] } : {}),
    },
    select: { PERIOD_ID: true, PERIOD_START_DATE: true, PERIOD_END_DATE: true, FISCAL_PERIOD_DESC: true },
    orderBy: [{ PERIOD_START_DATE: 'asc' }, { PERIOD_ID: 'asc' }],
  });
}

export const periodOptions = (rows: PeriodRow[]) =>
  rows.map((p) => ({ value: p.PERIOD_ID, label: p.FISCAL_PERIOD_DESC ?? `${dayOf(p.PERIOD_START_DATE)} – ${dayOf(p.PERIOD_END_DATE)}` }));

/** CI period_mst_m::getPeriodByDateAndCode('OPTS', date, brand): the active timesheet period containing `day`. */
export async function periodOn(day: string, oaBrandId: number): Promise<PeriodRow | null> {
  const [typeId, activeId] = await Promise.all([getMasterId(PERIOD_TYPE), getMasterId('OPSA')]);
  if (!typeId) return null;
  return prisma.period_mst.findFirst({
    where: {
      PERIOD_TYPE_ID: typeId,
      OA_BRAND_ID: oaBrandId,
      IS_DELETED: 0,
      ...(activeId ? { PERIOD_STATUS_ID: activeId } : {}),
      PERIOD_START_DATE: { lte: asDate(day) },
      PERIOD_END_DATE: { gte: asDate(day) },
    },
    select: { PERIOD_ID: true, PERIOD_START_DATE: true, PERIOD_END_DATE: true, FISCAL_PERIOD_DESC: true },
    orderBy: { PERIOD_ID: 'asc' },
  });
}

/** A timesheet period of the brand by id (any status), or null. */
export async function periodById(periodId: number, oaBrandId: number | null): Promise<PeriodRow | null> {
  const typeId = await getMasterId(PERIOD_TYPE);
  return prisma.period_mst.findFirst({
    where: { PERIOD_ID: periodId, IS_DELETED: 0, ...(typeId ? { PERIOD_TYPE_ID: typeId } : {}), ...(oaBrandId ? { OA_BRAND_ID: oaBrandId } : {}) },
    select: { PERIOD_ID: true, PERIOD_START_DATE: true, PERIOD_END_DATE: true, FISCAL_PERIOD_DESC: true },
  });
}

export interface TsEmployee {
  TS_EMP_ID: number;
  REF_EMP_ID: number | null;
  EMP_NM: string | null;
  MANAGER_ID: number | null;
  IS_MANAGER: string | null;
  OA_ID: number | null;
  OA_BRAND_ID: number;
}

const EMPLOYEE_SELECT = {
  TS_EMP_ID: true, REF_EMP_ID: true, EMP_NM: true, MANAGER_ID: true, IS_MANAGER: true, OA_ID: true, OA_BRAND_ID: true,
} as const;

/** CI timesheet_emp_m::get_tsempid_by_userid: the user's timesheet employee row. */
export async function employeeOfUser(userId: number): Promise<TsEmployee | null> {
  return prisma.timesheet_employee.findFirst({
    where: { REF_EMP_ID: userId, IS_DELETED: 0 },
    select: EMPLOYEE_SELECT,
    orderBy: { TS_EMP_ID: 'asc' },
  });
}

export async function employeeById(tsEmpId: number): Promise<TsEmployee | null> {
  return prisma.timesheet_employee.findFirst({ where: { TS_EMP_ID: tsEmpId, IS_DELETED: 0 }, select: EMPLOYEE_SELECT });
}

/** CI setFormControls: the approver is the REF_EMP_ID (user) of the employee's manager (MANAGER_ID → TS_EMP_ID). */
export async function approverOf(employee: TsEmployee): Promise<number | null> {
  if (!employee.MANAGER_ID) return null;
  const manager = await prisma.timesheet_employee.findFirst({
    where: { TS_EMP_ID: employee.MANAGER_ID },
    select: { REF_EMP_ID: true },
  });
  return manager?.REF_EMP_ID ?? null;
}

/** CI "IS_MANAGER = 1" on the caller's timesheet employee row. */
export async function isTimesheetManager(userId: number): Promise<boolean> {
  const row = await prisma.timesheet_employee.findFirst({
    where: { REF_EMP_ID: userId, IS_MANAGER: '1', IS_DELETED: 0 },
    select: { TS_EMP_ID: true },
  });
  return !!row;
}

/** CI timesheet_m::getAllEmployeeMst(): the brand's current employees (timesheet_employee_vw). */
export async function employeeOptions(oaBrandId: number): Promise<Array<{ value: number; label: string }>> {
  const current = await getMasterId(EMP_CURRENT);
  const rows = await prisma.$queryRaw<Array<{ TS_EMP_ID: number; EMP_NM: string | null }>>`
    SELECT "TS_EMP_ID", "EMP_NM" FROM timesheet_employee_vw
    WHERE "OABRANDID" = ${oaBrandId} AND "IS_DELETED" = 0 AND "EMP_STATUS_ID" = ${current ?? -1}
    ORDER BY "EMP_NM", "TS_EMP_ID"`;
  return rows.map((r) => ({ value: r.TS_EMP_ID, label: r.EMP_NM?.trim() || `#${r.TS_EMP_ID}` }));
}

const asOptions = (rows: MasterOption[]) => rows.map((o) => ({ value: o.value, label: o.label }));

/** CI getAllIndMstDetailsByTypeId(DURATIONUNITID): Hour(s) / Minute(s). */
export async function durationUnitOptions() {
  return asOptions(await getMasterOptionsByTypeCode(DURATION_UNIT_TYPE));
}

/** CI getAllIndMstDetailsByTypeCode('TP' | 'TA', brand): the brand's projects / activities. */
export async function projectOptions(oaBrandId: number) {
  return asOptions(await getMasterOptionsByTypeCode(PROJECT_TYPE, { oaBrandId }));
}
export async function activityOptions(oaBrandId: number) {
  return asOptions(await getMasterOptionsByTypeCode(ACTIVITY_TYPE, { oaBrandId }));
}

/** CI timesheet_m::getCurrentProject($user): the enabled project marked current for the user. */
export async function currentProject(userId: number): Promise<number | null> {
  const row = await prisma.user_project_details.findFirst({
    where: { USER_ID: userId, IS_CURRENT: 1, IS_ENABLED: 1 },
    select: { PROJECT_ID: true },
  });
  return row?.PROJECT_ID ?? null;
}

/** CI timesheet_m::getCurrentActivity($user, $project). */
export async function currentActivity(userId: number, projectId: number | null): Promise<number | null> {
  if (!projectId) return null;
  const row = await prisma.user_activity_details.findFirst({
    where: { USER_ID: userId, PROJECT_ID: projectId, IS_CURRENT: 1, IS_ENABLED: 1 },
    select: { ACTIVITY_ID: true },
  });
  return row?.ACTIVITY_ID ?? null;
}

/** CI "Activity tab" setting (empty = Yes): project / activity / duration and the items table. */
export async function activityTabEnabled(oaBrandId: number | null): Promise<boolean> {
  if (!oaBrandId) return true;
  const value = await settingService.getValue(SETTING.activityTab, oaBrandId);
  return value === null || value === '' || isYes(value);
}

/** CI SSADTSD = 'Yes': delayed timesheet deduction. */
export async function delayedDeductionEnabled(oaBrandId: number | null): Promise<boolean> {
  return !!oaBrandId && isYes(await settingService.getValue(SETTING.delayedDeduction, oaBrandId));
}

export interface AllowedRange {
  start: string;
  end: string;
  delayed: boolean;
}

/**
 * CI timesheet_emp_m::get_allowed_timesheet_date_ranges: today, each grace day before it (delayed),
 * and the delayed-timesheet permissions granted to the employee (deleted grants are skipped).
 */
export async function allowedRanges(userId: number, oaBrandId: number, today = new Date()): Promise<AllowedRange[]> {
  const day = ymd(today);
  const ranges: AllowedRange[] = [{ start: day, end: day, delayed: false }];
  const grace = toNumber(await settingService.getValue(SETTING.graceDays, oaBrandId));
  for (let i = 1; i <= grace; i++) {
    const d = ymd(addDays(today, -i));
    ranges.push({ start: d, end: d, delayed: true });
  }
  const employee = await employeeOfUser(userId);
  if (employee) {
    const grants = await prisma.delayed_timesheet_permission.findMany({
      where: { TS_EMP_ID: employee.TS_EMP_ID, OA_BRAND_ID: oaBrandId, OR: [{ IS_DELETED: 0 }, { IS_DELETED: null }] },
      select: { START_DATE: true, END_DATE: true, DELAYED_FLAG: true },
    });
    for (const g of grants) ranges.push({ start: dayOf(g.START_DATE), end: dayOf(g.END_DATE), delayed: g.DELAYED_FLAG });
  }
  return ranges;
}

/** CI period_mst_m::getAllowedPeriodsForUser: periods overlapping an allowed range. */
export function periodsWithin(periods: PeriodRow[], ranges: AllowedRange[]): PeriodRow[] {
  return periods.filter((p) => {
    const start = dayOf(p.PERIOD_START_DATE);
    const end = dayOf(p.PERIOD_END_DATE);
    return ranges.some((r) => r.end >= start && r.start <= end);
  });
}

/**
 * The periods a caller may open a new timesheet in (CI initForm): with delayed deduction on, a normal
 * user only gets periods overlapping his allowed ranges; everyone else every open period.
 */
export async function periodsForNewTimesheet(subject: RequestSubject, oaBrandId: number): Promise<PeriodRow[]> {
  const periods = await openPeriods(oaBrandId);
  if (subject.adminLevel !== 0 || !(await delayedDeductionEnabled(oaBrandId))) return periods;
  return periodsWithin(periods, await allowedRanges(subject.userId, oaBrandId));
}

/** CI session permissions_class_id with code 'PCM' (Managerial Service): the "My Team" links. */
export async function hasManagerClass(subject: RequestSubject): Promise<boolean> {
  if (!subject.oaBrandId) return false;
  const { permissionsClassId } = await resolvePermissionsClassId(subject.oaBrandId, subject.userId);
  return (await getMasterCode(permissionsClassId)) === MANAGER_CLASS;
}

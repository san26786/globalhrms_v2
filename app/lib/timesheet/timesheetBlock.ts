import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { ForbiddenError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { arrayToCsv } from '@/lib/utils/csv';
import { PERIOD_TYPE } from './timesheet.constants';
import { asDate, dayOf, employeeById, employeeOptions, periodOn, statusIds, ymd, type StatusIds } from './timesheet.lookups';
import { timesheetPolicy } from './timesheet.service';

/**
 * Manage Timesheet / Submit for Approval Timesheet — CI timesheet/timesheet::timesheetBlock
 * ($monthOffset, $empId) and its exports (exportTimesheetDetail / exportTimesheetHours):
 *  - one card per active timesheet period starting in the month, with the timesheet's status;
 *  - Previous / Next month; administrators pick the employee (CI EMPID; without one no timesheets);
 *  - the period of seven days ago is highlighted (CI current_period);
 *  - administrators export the month's hours per employee and status, or every item.
 */

export interface BlockPeriod {
  periodId: number;
  description: string;
  start: string;
  end: string;
  timesheet: { id: number; statusId: number; status: string } | null;
}

export interface BlockData {
  month: string;
  previous: string;
  next: string;
  currentPeriodId: number | null;
  isAdmin: boolean;
  employeeId: number | null;
  employees: Array<{ value: number; label: string }>;
  statuses: StatusIds;
  periods: BlockPeriod[];
}

/** "YYYY-MM" → the month's first day (default: this month). */
function monthOf(raw: string | undefined): Date {
  return startOfMonth(raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? parseISO(`${raw}-01`) : new Date());
}

export async function blockData(subject: RequestSubject, query: Record<string, string>): Promise<BlockData> {
  if (!(await timesheetPolicy.check(subject, 'list'))) throw new ForbiddenError();
  const first = monthOf(query.month);
  const last = endOfMonth(first);
  const brandId = subject.oaBrandId ?? -1;
  const isAdmin = subject.adminLevel >= 1;

  // Whose timesheets: a user his own; an administrator the chosen employee's (of his brand).
  const empId = Number(query.empId);
  let userId: number | null = isAdmin ? null : subject.userId;
  let employeeId: number | null = null;
  if (isAdmin && Number.isInteger(empId) && empId > 0) {
    const employee = await employeeById(empId);
    if (employee && (subject.adminLevel === 2 || employee.OA_BRAND_ID === subject.oaBrandId)) {
      userId = employee.REF_EMP_ID;
      employeeId = employee.TS_EMP_ID;
    }
  }

  const [typeId, activeId, statuses, current, employees] = await Promise.all([
    getMasterId(PERIOD_TYPE),
    getMasterId('OPSA'),
    statusIds(),
    periodOn(ymd(addDays(new Date(), -7)), brandId),
    isAdmin && subject.oaBrandId ? employeeOptions(subject.oaBrandId) : Promise.resolve([]),
  ]);
  const periods = await prisma.period_mst.findMany({
    where: {
      PERIOD_TYPE_ID: typeId ?? -1,
      PERIOD_STATUS_ID: activeId ?? -1,
      PERIOD_ENDED: false,
      IS_DELETED: 0,
      OA_BRAND_ID: brandId,
      PERIOD_START_DATE: { gte: asDate(ymd(first)), lte: asDate(ymd(last)) },
    },
    select: { PERIOD_ID: true, FISCAL_PERIOD_DESC: true, PERIOD_START_DATE: true, PERIOD_END_DATE: true },
    orderBy: [{ PERIOD_START_DATE: 'asc' }, { PERIOD_ID: 'asc' }],
  });
  const timesheets = userId && periods.length
    ? await prisma.timesheet.findMany({
        where: { USER_ID: userId, IS_DELETED: 0, PERIOD_ID: { in: periods.map((p) => p.PERIOD_ID) } },
        select: { TS_ID: true, PERIOD_ID: true, TS_STATUS_ID: true },
        orderBy: { TS_ID: 'asc' },
      })
    : [];
  const statusNames = new Map(
    (await prisma.independent_mst.findMany({ where: { MSTR_ID: { in: Object.values(statuses) } }, select: { MSTR_ID: true, MSTR_NM: true } })).map((m) => [m.MSTR_ID, m.MSTR_NM.trim()]),
  );

  return {
    month: format(first, 'yyyy-MM'),
    previous: format(addMonths(first, -1), 'yyyy-MM'),
    next: format(addMonths(first, 1), 'yyyy-MM'),
    currentPeriodId: current?.PERIOD_ID ?? null,
    isAdmin,
    employeeId,
    employees,
    statuses,
    periods: periods.map((p) => {
      const ts = timesheets.find((t) => t.PERIOD_ID === p.PERIOD_ID);
      return {
        periodId: p.PERIOD_ID,
        description: p.FISCAL_PERIOD_DESC ?? '',
        start: dayOf(p.PERIOD_START_DATE),
        end: dayOf(p.PERIOD_END_DATE),
        timesheet: ts ? { id: ts.TS_ID, statusId: ts.TS_STATUS_ID, status: statusNames.get(ts.TS_STATUS_ID) ?? '' } : null,
      };
    }),
  };
}

/**
 * CI timesheet_m::export_csv ("Export Timesheet Hours") and ::export_detail_csv ("Export Timesheet
 * Details") for the brand's timesheets inside the month. Administrators only.
 */
export async function exportCsv(subject: RequestSubject, kind: string, query: Record<string, string>): Promise<{ filename: string; csv: string }> {
  if (subject.adminLevel < 1 || !(await timesheetPolicy.check(subject, 'list'))) throw new ForbiddenError();
  const first = monthOf(query.month);
  const from = asDate(ymd(first));
  const to = asDate(ymd(endOfMonth(first)));
  const brandId = subject.oaBrandId ?? -1;
  const brand = await prisma.oa_brands.findFirst({ where: { OA_BRAND_ID: brandId }, select: { OA_BRAND_NM: true } });
  const label = `${brand?.OA_BRAND_NM ?? 'Brand'} - ${format(first, 'MMMM-yyyy')}`;

  if (kind === 'hours') {
    const st = await statusIds();
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT ${format(first, 'MMMM-yyyy')} AS "Month", t."EMP_NM" AS "Employee Name",
             COALESCE(SUM(t."ACTIVITY_DURATION") FILTER (WHERE t."TS_STATUS_ID" = ${st.pending}), 0) AS "Approval Pending",
             COALESCE(SUM(t."ACTIVITY_DURATION") FILTER (WHERE t."TS_STATUS_ID" = ${st.draft}), 0) AS "Draft",
             COALESCE(SUM(t."ACTIVITY_DURATION") FILTER (WHERE t."TS_STATUS_ID" = ${st.approved}), 0) AS "Approved",
             COALESCE(SUM(t."ACTIVITY_DURATION") FILTER (WHERE t."TS_STATUS_ID" = ${st.rejected}), 0) AS "Rejected",
             COALESCE(SUM(t."ACTIVITY_DURATION"), 0) AS "Total Hours"
      FROM timesheet_vw t
      WHERE t."OABRANDID" = ${brandId} AND t."TS_START_DATE" >= ${from} AND t."TS_END_DATE" <= ${to}
      GROUP BY t."EMP_NM" ORDER BY t."EMP_NM"`;
    const headers = ['Month', 'Employee Name', 'Approval Pending', 'Draft', 'Approved', 'Rejected', 'Total Hours'];
    return { filename: `Timesheet Report ${label}.csv`, csv: arrayToCsv(headers, headers, rows.map((r) => ({ ...r, ...num(r, headers.slice(2)) }))) };
  }

  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT (SELECT te."EMP_NM" FROM timesheet_employee te WHERE te."TS_EMP_ID" = ts."TS_EMP_ID" LIMIT 1) AS "Employee Name",
           TO_CHAR(ti."TS_DATE", 'YYYY-MM-DD') AS "Date", TO_CHAR(ti."START_TIME", 'HH24:MI') AS "Start Time",
           TO_CHAR(ti."END_TIME", 'HH24:MI') AS "End Time", ti."COMMENT" AS "Comments"
    FROM timesheet_item ti JOIN timesheet ts ON ts."TS_ID" = ti."TS_ID"
    WHERE ti."IS_DELETED" = 0 AND ts."IS_DELETED" = 0 AND ts."OA_BRAND_ID" = ${brandId}
      AND ts."TS_START_DATE" >= ${from} AND ts."TS_END_DATE" <= ${to}
    ORDER BY ts."TS_EMP_ID", ti."TS_DATE", ti."START_TIME"`;
  const headers = ['Employee Name', 'Date', 'Start Time', 'End Time', 'Comments'];
  return { filename: `Timesheet Detail Report ${label}.csv`, csv: arrayToCsv(headers, headers, rows) };
}

/** Decimal sums → plain numbers in the CSV. */
function num(row: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, Number(row[k] ?? 0)]));
}

import { prisma } from '@/lib/prisma';
import { SUMMARY_DAYS, SUMMARY_HOURS, payrollSummaryDefs } from '../defs/payroll_summary';
import { masterName, type DbValue, type HubConfig } from '../hubEngine';
import { keepCurrent, masterLabel, mastersByCode } from '../hubOptions';

/**
 * CI attndMngt/payroll_summary ("Payroll Attendance Summary"): an employee's attendance totals for a month
 * (table payroll_attendance_summary). Today's rows come from the Monthly Register recalculation; salary
 * generation reads Absent Days as loss-of-pay days when the employee has no attendance register for the month.
 *
 * As CI: one row per employee and month ("Already exists record with this Employee-Month-Year combination").
 * Behaviour changes: only admins add, edit or delete (CI had no check at all, and any record could be changed
 * by id); the record is the employee's (CI saved the OA / brand / user posted from the form); the list filters
 * by month and year (CI: month only, every year's); the month must be given as MM/YYYY and not in the future,
 * and the counts must be whole numbers within the month (CI accepted "/" and text); editing writes the month
 * and year to both column pairs (CI left MONTH / YEAR stale, so its duplicate check missed); deleted rows no
 * longer count as duplicates. Not migrated: CI's Sync button — unused since 2019, it hard-deleted every summary
 * of the brand (a super admin's run, of every brand) and counted punches instead of days, under the wrong
 * employee id.
 */
const MONTH = `COALESCE(t."CALENDAR_MONTH", NULLIF(t."MONTH", 0))`;
const YEAR = `COALESCE(t."CALENDAR_YEAR", NULLIF(t."YEAR", 0))`;
const COUNTS = ['CALENDAR_WEEK', ...SUMMARY_DAYS, ...SUMMARY_HOURS];
const LABELS = Object.fromEntries(payrollSummaryDefs.fields.map((f) => [f.name, f.label]));

/** "MM/YYYY" → month and year; a legacy row without a year reads "MM/". */
function monthYear(value: string | boolean): { month: number | null; year: number | null } {
  const m = /^(0?[1-9]|1[0-2])\/(\d{4})?$/.exec(String(value).trim());
  return m ? { month: Number(m[1]), year: m[2] ? Number(m[2]) : null } : { month: null, year: null };
}

const daysIn = (month: number, year: number | null) => new Date(Date.UTC(year ?? 2000, month, 0)).getUTCDate();

export const payrollSummaryConfig: HubConfig = {
  key: 'payroll_summary',
  defs: payrollSummaryDefs,
  table: 'payroll_attendance_summary',
  pk: 'PAS_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: `${MONTH} AS "CALENDAR_MONTH",
    CASE WHEN ${MONTH} BETWEEN 1 AND 12 THEN to_char(make_date(2000, ${MONTH}, 1), 'FMMonth') END AS "MONTH_NAME",
    ${YEAR} AS "CALENDAR_YEAR", ${masterName('t."PAY_FREQUENCY"')} AS "PAY_FREQUENCY_NM", ${masterName('t."STATUS"')} AS "STATUS_NM",
    ${COUNTS.map((c) => `t."${c}"`).join(', ')}`,
  search: ['MONTH_NAME', 'CALENDAR_YEAR', 'PAY_FREQUENCY_NM', 'STATUS_NM'],
  sorts: ['CALENDAR_MONTH', 'CALENDAR_YEAR', 'PAY_FREQUENCY_NM', 'STATUS_NM', ...COUNTS],
  bind: Object.fromEntries(['PAY_FREQUENCY', 'STATUS', ...COUNTS].map((c) => [c, c])),
  deleteMode: 'soft',
  adminOnlyWrites: true,
  messages: { created: 'Successfully Added Payroll Summary', updated: 'Successfully Updated Payroll Summary.', deleted: 'Successfully Deleted Payroll Summary.' },

  // CI customFields: the month (and, new, the year) to list.
  listFilter(q, sql) {
    const conditions: string[] = [];
    const month = Number(q.month);
    const year = Number(q.year);
    if (Number.isInteger(month) && month >= 1 && month <= 12) conditions.push(`v."CALENDAR_MONTH" = ${sql.p(month)}::int`);
    if (Number.isInteger(year) && year >= 1900 && year <= 2100) conditions.push(`v."CALENDAR_YEAR" = ${sql.p(year)}::int`);
    return conditions.length ? conditions.join(' AND ') : null;
  },

  options: async (_subject, _brand, row) => {
    const [frequencies, statuses] = await Promise.all([mastersByCode('PF'), mastersByCode('US')]);
    return {
      payFrequencies: await keepCurrent(frequencies, row?.PAY_FREQUENCY, masterLabel),
      statuses: await keepCurrent(statuses, row?.STATUS, masterLabel),
    };
  },

  // Salary is generated for the month just ended.
  async defaults() {
    const now = new Date();
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    return { MONTH_YEAR: `${String(last.getUTCMonth() + 1).padStart(2, '0')}/${last.getUTCFullYear()}` };
  },

  read(row, values) {
    const month = Number(row.CALENDAR_MONTH) || Number(row.MONTH) || 0;
    const year = Number(row.CALENDAR_YEAR) || Number(row.YEAR) || 0;
    values.MONTH_YEAR = month >= 1 && month <= 12 ? `${String(month).padStart(2, '0')}/${year || ''}` : '';
  },

  async validate(v, check, ctx) {
    const changed = (name: string) => v[name] !== ctx.existing?.[name];
    let { month, year } = monthYear(v.MONTH_YEAR);
    if (!check.has('MONTH_YEAR') && changed('MONTH_YEAR')) {
      if (!month || !year || year < 1900 || year > 2100) {
        check.fail('MONTH_YEAR', 'The Month / Year field must be in MM/YYYY format.');
        month = year = null;
      } else {
        const now = new Date();
        if (year * 12 + month > now.getUTCFullYear() * 12 + now.getUTCMonth() + 1) check.fail('MONTH_YEAR', 'The Month / Year cannot be in the future.');
      }
    }

    const days = month ? daysIn(month, year) : 31;
    for (const name of COUNTS) {
      const value = String(v[name] ?? '');
      if (!value || check.has(name) || !changed(name)) continue;
      if (!/^\d+$/.test(value)) check.fail(name, `The ${LABELS[name]} field must contain a whole number.`);
      else if (name === 'CALENDAR_WEEK' && (Number(value) < 1 || Number(value) > 53)) check.fail(name, 'The Calendar Week field must be between 1 and 53.');
      else if (SUMMARY_DAYS.includes(name) && Number(value) > days) check.fail(name, `The ${LABELS[name]} field cannot be more than the ${days} days of the month.`);
      else if (SUMMARY_HOURS.includes(name) && Number(value) > 744) check.fail(name, `The ${LABELS[name]} field cannot be more than 744 hours.`);
    }

    if (!month || !year || check.has('MONTH_YEAR')) return;
    const [duplicate] = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT t."PAS_ID" AS id FROM payroll_attendance_summary t
       WHERE t."EMP_ID" = $1::int AND t."IS_DELETED" = 0 AND t."PAS_ID" <> $2::int AND ${MONTH} = $3::int AND ${YEAR} = $4::int LIMIT 1`,
      ctx.employee.id, ctx.id ?? -1, month, year,
    );
    if (duplicate) check.fail('MONTH_YEAR', 'Already exists record with this Employee-Month-Year combination');
  },

  // Both column pairs hold the month (CI's writers each filled one); USER_ID / OA_ID are NOT NULL.
  extraColumns(v, ctx) {
    const { month, year } = monthYear(v.MONTH_YEAR);
    const extra: Record<string, DbValue> = { USER_ID: ctx.employee.userId ?? ctx.subject.userId, OA_ID: ctx.employee.oaId ?? 0 };
    if (month) Object.assign(extra, { CALENDAR_MONTH: month, MONTH: month });
    if (year) Object.assign(extra, { CALENDAR_YEAR: year, YEAR: year });
    return extra;
  },
};

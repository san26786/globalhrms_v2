import { prisma } from '@/lib/prisma';
import { FIXED_SHIFT, empWorkShiftDefs } from '../defs/emp_work_shift';
import { insertRow, isDate, masterName, type DbValue, type HubConfig } from '../hubEngine';
import { brandOnlyMasters, keepCurrent, masterLabel, mastersByCode } from '../hubOptions';

/**
 * CI employeeMngt/emp_work_shift ("Work Shifts"): the shift an employee works (table emp_work_shift,
 * employee in EMP_NUMBER) and, for a fixed shift, the hours per weekday (emp_work_shift_timing, replaced
 * on every save). Read by the late-coming summary.
 *
 * As CI: only admins add, edit or delete. Behaviour changes: one live work shift per employee (every
 * employee has one today and the late-coming summary takes the first); the employee and effective date
 * are required (CI required neither, and only allowed dates up to yesterday); a variable shift needs its
 * start date and days or end date, the missing one being worked out (CI's browser did that); a fixed
 * shift needs its hours, one line per day, each day once, start ≠ end; editing keeps the effective-to
 * date and the previous / next shift links (CI wiped them); shifts and calendars are the employee's
 * brand's; the list shows the shift, type and hours instead of CI's ids and last-modified stamp. The hours
 * are typed as lines ("Mon 09:00-18:00") instead of CI's day / time pickers.
 */
const CALENDAR = 208;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME = '([01]?\\d|2[0-3]):([0-5]\\d)';
const LINE = new RegExp(`^(${DAYS.join('|')})[a-z]*(?:\\s*-\\s*(${DAYS.join('|')})[a-z]*)?\\s+${TIME}\\s*-\\s*${TIME}$`, 'i');

interface Timing { weekday: number; start: string; end: string }

/** "Mon 09:00-18:00" / "Mon-Sat 10:00-19:00" lines → one timing per weekday, or the error. */
export function parseHours(text: string): Timing[] | string {
  const out: Timing[] = [];
  for (const raw of text.split(/[\n|;]+/).map((l) => l.trim()).filter(Boolean)) {
    const m = LINE.exec(raw);
    if (!m) return `"${raw}" is not like "Mon 09:00-18:00".`;
    const day = (name: string) => DAYS.findIndex((d) => d.toLowerCase() === name.slice(0, 3).toLowerCase());
    const first = day(m[1]);
    const last = m[2] ? day(m[2]) : first;
    const pad = (h: string, min: string) => `${h.padStart(2, '0')}:${min}`;
    const start = pad(m[3], m[4]);
    const end = pad(m[5], m[6]);
    if (start === end) return `${raw}: start and end time cannot be the same.`;
    for (let d = first; ; d = (d + 1) % 7) {
      if (out.some((t) => t.weekday === d)) return `${DAYS[d]} is given more than once.`;
      out.push({ weekday: d, start, end });
      if (d === last) break;
    }
  }
  return out.sort((a, b) => a.weekday - b.weekday);
}

const HOURS_LIST = `(SELECT string_agg((ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[x."WEEKDAY" + 1] || ' ' || to_char(x."START_TIME", 'HH24:MI')
    || '-' || to_char(x."END_TIME", 'HH24:MI'), ', ' ORDER BY x."WEEKDAY", x."START_TIME")
  FROM emp_work_shift_timing x WHERE x."WORK_SHIFT_ID" = t."EMP_WORK_SHIFT_ID")`;

/** CI getShiftDtlForBrand(): the brand's shifts; repeated names get their id. */
async function shiftOptions(brand: number | null) {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string | null }>>`
    SELECT sm."SHIFT_ID" AS value, sm."NAME" AS label FROM shift_mst sm
    WHERE sm."OA_BRAND_ID" = ${brand ?? -1} AND sm."IS_DELETED" = 0 ORDER BY sm."NAME", sm."SHIFT_ID"`;
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.label ?? '', (counts.get(r.label ?? '') ?? 0) + 1);
  return rows.map((r) => ({ value: Number(r.value), label: (counts.get(r.label ?? '') ?? 0) > 1 ? `${r.label} (#${r.value})` : (r.label ?? `#${r.value}`) }));
}

async function shiftLabel(id: number): Promise<string | null> {
  const row = await prisma.shift_mst.findFirst({ where: { SHIFT_ID: id }, select: { NAME: true } });
  return row?.NAME ?? null;
}

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

export const empWorkShiftConfig: HubConfig = {
  key: 'emp_work_shift',
  defs: empWorkShiftDefs,
  table: 'emp_work_shift',
  pk: 'EMP_WORK_SHIFT_ID',
  empColumn: 'EMP_NUMBER',
  alive: 't."IS_DELETED" = 0',
  listColumns: `(SELECT sm."NAME" FROM shift_mst sm WHERE sm."SHIFT_ID" = t."WORK_SHIFT_ID" LIMIT 1) AS "WORK_SHIFT",
    ${masterName('t."SHIFT_TYPE_ID"')} AS "SHIFT_TYPE", ${masterName('t."SHIFT_CALENDAR_ID"')} AS "SHIFT_CALENDAR",
    to_char(t."EFFECTIVE_ON", 'YYYY-MM-DD') AS "EFFECTIVE_ON", ${HOURS_LIST} AS "HOURS",
    to_char(t."START_DATE", 'YYYY-MM-DD') AS "START_DATE", to_char(t."END_DATE", 'YYYY-MM-DD') AS "END_DATE", NULLIF(t."NO_OF_DAYS", 0) AS "NO_OF_DAYS"`,
  search: ['WORK_SHIFT', 'SHIFT_TYPE', 'SHIFT_CALENDAR', 'HOURS'],
  sorts: ['WORK_SHIFT', 'SHIFT_TYPE', 'EFFECTIVE_ON', 'START_DATE', 'END_DATE', 'NO_OF_DAYS'],
  bind: {
    WORK_SHIFT_ID: 'WORK_SHIFT_ID', EFFECTIVE_ON: 'EFFECTIVE_ON', SHIFT_CALENDAR_ID: 'SHIFT_CALENDAR_ID', SHIFT_TYPE_ID: 'SHIFT_TYPE_ID',
    START_DATE: 'START_DATE', NO_OF_DAYS: 'NO_OF_DAYS', END_DATE: 'END_DATE',
  },
  deleteMode: 'soft',
  adminOnlyWrites: true,
  messages: {
    created: 'Successfully Added Employee Work Shift Details',
    updated: 'Successfully Updated Employee Work Shift Details',
    deleted: 'Successfully Deleted',
  },

  defaults: async () => ({ SHIFT_TYPE_ID: FIXED_SHIFT }),

  options: async (_subject, brand, row) => {
    const [shifts, calendars, types] = await Promise.all([
      shiftOptions(brand), brandOnlyMasters({ id: CALENDAR }, brand, { enabledOnly: true }), mastersByCode('RST'),
    ]);
    return {
      shifts: await keepCurrent(shifts, row?.WORK_SHIFT_ID, shiftLabel),
      calendars: await keepCurrent(calendars, row?.SHIFT_CALENDAR_ID, masterLabel),
      shiftTypes: await keepCurrent(types, row?.SHIFT_TYPE_ID, masterLabel),
    };
  },

  async read(row, values) {
    const rows = await prisma.$queryRaw<Array<{ line: string }>>`
      SELECT (ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])["WEEKDAY" + 1] || ' ' || to_char("START_TIME", 'HH24:MI') || '-' || to_char("END_TIME", 'HH24:MI') AS line
      FROM emp_work_shift_timing WHERE "WORK_SHIFT_ID" = ${Number(row.EMP_WORK_SHIFT_ID)} ORDER BY "WEEKDAY", "START_TIME"`;
    values.hours = rows.map((r) => r.line).join('\n');
    if (values.NO_OF_DAYS === '0') values.NO_OF_DAYS = '';
  },

  async validate(v, check, ctx) {
    if (!ctx.id) {
      const [existing] = await prisma.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM emp_work_shift WHERE "EMP_NUMBER" = ${ctx.employee.id} AND "IS_DELETED" = 0`;
      if (existing.n) check.fail('WORK_SHIFT_ID', 'This employee already has a work shift; edit it instead.');
    }
    if (String(v.SHIFT_TYPE_ID) !== FIXED_SHIFT) {
      const days = String(v.NO_OF_DAYS);
      const start = String(v.START_DATE);
      const end = String(v.END_DATE);
      if (days && !/^\d{1,4}$/.test(days)) check.fail('NO_OF_DAYS', 'The No of Days field must be a whole number.');
      else if (days && Number(days) < 1) check.fail('NO_OF_DAYS', 'The No of Days field must be at least 1.');
      if (!days && !end && start) check.fail('NO_OF_DAYS', 'Give the No of Days or the End Date.');
      if (start && end && isDate(start) && isDate(end) && end < start) check.fail('END_DATE', 'End Date must be on or after Start Date.');
    }
    const hours = String(v.hours ?? '');
    if (hours && hours !== ctx.existing?.hours) {
      const parsed = parseHours(hours);
      if (typeof parsed === 'string') check.fail('hours', parsed);
    }
  },

  /** Variable shift: the end date or the number of days, from the other (CI's form script). */
  extraColumns(v, ctx): Record<string, DbValue> {
    const extra: Record<string, DbValue> = {};
    if (String(v.SHIFT_TYPE_ID) !== FIXED_SHIFT && v.START_DATE) {
      const start = String(v.START_DATE);
      if (v.NO_OF_DAYS) extra.END_DATE = addDays(start, Number(v.NO_OF_DAYS) - 1);
      else if (v.END_DATE) extra.NO_OF_DAYS = daysBetween(start, String(v.END_DATE)) + 1;
    }
    if (!ctx.id) Object.assign(extra, { PREV_WORK_SHIFT_ID: 0, NEXT_WORK_SHIFT_ID: 0 });
    return extra;
  },

  /** CI updateTimings(): the hours of the shift replace the saved ones. */
  async afterWrite(tx, id, v, ctx) {
    if (ctx.existing && v.hours === ctx.existing.hours) return;
    const parsed = parseHours(String(v.hours ?? ''));
    if (typeof parsed === 'string') return;
    await tx.$executeRaw`DELETE FROM emp_work_shift_timing WHERE "WORK_SHIFT_ID" = ${id}`;
    const { employee, subject } = ctx;
    for (const t of parsed) {
      await insertRow(tx, 'emp_work_shift_timing', 'WORK_SHIFT_TIMING_ID', {
        WORK_SHIFT_ID: id, WEEKDAY: t.weekday, START_TIME: t.start, END_TIME: t.end,
        OA_ID: employee.oaId ?? 0, OA_BRAND_ID: employee.brand, USER_ID: employee.userId ?? 0,
      }, subject.userId);
    }
  },
};

import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { BusinessRuleError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { settingService } from '@/lib/settings/settingService';
import type { ScopedBrand } from './access';

/**
 * Period generation — port of CI period_mst_m::getPeriodData / generatePeriods / generatePeriod
 * (utilities/period_manager "Sync Period").
 *
 * Preserved CI rules
 *  - one entry per period type: start-date setting + frequency setting + period-type master code;
 *    a missing setting / type or an unparseable date → "Could Not Generate Period For …";
 *  - period status = master OPSA; IS_VERIFIED = 1 when brand setting SSACVPS has any value;
 *  - when a period of that type already covers the start date, the start moves one year ahead
 *    (checkAndGetAnotherYearDate) — only while the checked year is before the current year;
 *  - generation ends on the anniversary of the start (this year, or next year when already reached)
 *    minus one day; the first slot is always attempted (CI do/while), later slots while start <= end;
 *  - frequencies monthly / quarterly / half annually / annually / weekly / daily with CI descriptions:
 *    "{type} Mon YYYY", "{type} YYYY" or "{type} YYYY - YYYY", "{type} YYYY-MM-DD",
 *    "{type} Week WW-YYYY" + "(Part 1)" / "(Part 2)" when an ISO week is split at a month end;
 *  - rows: PERIOD_START/END_DATE, PERIOD_TYPE_ID, FISCAL_PERIOD_DESC, PERIOD_STATUS_ID, IS_VERIFIED,
 *    OA_BRAND_ID, OA_ID (of the brand), USER_ID / CREATED_BY (caller), CREATED_ON.
 *
 * Fixed CI defects
 *  - Attendance Period settings (SSAAYSD / SSAATYF) were never loaded by CI — they are now;
 *  - the "next year" recursion guard was broken (depth reset each call) — bounded to 10 years;
 *  - an existing slot advanced the cursor by +1 month whatever the frequency (and could loop
 *    forever) — slots are now computed from the start by frequency and existing ones skipped;
 *  - weekly generation did not check for existing periods at all — it does now;
 *  - a slot is skipped when it overlaps any existing (not deleted) period of the type, so no
 *    overlapping periods are created;
 *  - all inserts happen in one transaction; month arithmetic clamps to month end (PHP overflowed
 *    "Jan 31 + 1 month" into March).
 */

interface PeriodTypeDef {
  periodType: string;
  startCode: string;
  frequencyCode: string;
  typeCode: string;
}

/** Order and codes exactly as CI getPeriodData(). */
export const PERIOD_TYPES: readonly PeriodTypeDef[] = [
  { periodType: 'Financial Year', startCode: 'SAACFYYSD', frequencyCode: 'SAACFYF', typeCode: 'OPTFY' },
  { periodType: 'Assessment Year', startCode: 'SAACASYYSD', frequencyCode: 'SAACASYF', typeCode: 'OPTAY' },
  { periodType: 'Accounting Year', startCode: 'SAACACYYSD', frequencyCode: 'SAACACYF', typeCode: 'OPTACY' },
  { periodType: 'Leave Period', startCode: 'SAALPYSD', frequencyCode: 'SAALPF', typeCode: 'OPTLP' },
  { periodType: 'Timesheet Period', startCode: 'SAATPYSD', frequencyCode: 'SAATPF', typeCode: 'OPTS' },
  { periodType: 'Achievement Period', startCode: 'SAAAPYSD', frequencyCode: 'SAAAPF', typeCode: 'OPAS' },
  { periodType: 'Performance Period', startCode: 'SAAPPYSD', frequencyCode: 'SAAPPF', typeCode: 'OPPS' },
  { periodType: 'OD Entry Period', startCode: 'SAAODEPYSD', frequencyCode: 'SAAODEPF', typeCode: 'PTOD' },
  { periodType: 'Academic Period', startCode: 'SSAOPTAY', frequencyCode: 'SSAAYF', typeCode: 'OPAY' },
  { periodType: 'Attendance Period', startCode: 'SSAAYSD', frequencyCode: 'SSAATYF', typeCode: 'OPATY' },
  { periodType: 'Tax Period', startCode: 'SSAFVRED', frequencyCode: 'SSAFVATRN', typeCode: 'OPTTXY' },
];

const STATUS_ACTIVE_CODE = 'OPSA';
const VERIFY_SETTING_CODE = 'SSACVPS';
const MAX_YEARS_AHEAD = 10;
const MAX_SLOTS_PER_TYPE = 5000;
const DESC_MAX = 40; // period_mst.FISCAL_PERIOD_DESC varchar(40)

export type PeriodResultStatus = 'generated' | 'exists' | 'not_generated';

export interface PeriodTypeResult {
  type: string;
  status: PeriodResultStatus;
  count: number;
  message: string;
}

export interface PeriodGenerationResult {
  brand: { oaBrandId: number; name: string };
  results: PeriodTypeResult[];
  /** CI flash messages. */
  messages: { success?: string; warning?: string; danger?: string };
}

// ------------------------------------------------------------------ date helpers (UTC-midnight dates)

type Day = Date;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function day(y: number, m0: number, d: number): Day {
  return new Date(Date.UTC(y, m0, d));
}

function daysInMonth(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

function addDays(d: Day, n: number): Day {
  return day(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n);
}

function addMonths(d: Day, n: number): Day {
  const total = d.getUTCMonth() + n;
  const y = d.getUTCFullYear() + Math.floor(total / 12);
  const m0 = ((total % 12) + 12) % 12;
  return day(y, m0, Math.min(d.getUTCDate(), daysInMonth(y, m0)));
}

function lastDayOfMonth(d: Day): Day {
  return day(d.getUTCFullYear(), d.getUTCMonth(), daysInMonth(d.getUTCFullYear(), d.getUTCMonth()));
}

function sameYearDate(y: number, like: Day): Day {
  const m0 = like.getUTCMonth();
  return day(y, m0, Math.min(like.getUTCDate(), daysInMonth(y, m0)));
}

function ymd(d: Day): string {
  return d.toISOString().slice(0, 10);
}

/** ISO-8601 weekday, Monday = 1 … Sunday = 7. */
function isoWeekday(d: Day): number {
  return d.getUTCDay() === 0 ? 7 : d.getUTCDay();
}

/** PHP date('W') / date('o'). */
function isoWeek(d: Day): { week: number; year: number } {
  const thursday = addDays(d, 4 - isoWeekday(d));
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - day(year, 0, 1).getTime()) / 86_400_000 / 7) + 1;
  return { week, year };
}

/** Today in the server's local calendar (CI used PHP's configured timezone). */
function today(now: Date): Day {
  return day(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * PHP strtotime() for the formats stored in the settings: "YYYY-MM-DD", "DD.MM.YYYY", "DD-MM-YYYY"
 * and "MM/DD/YYYY" (PHP reads slashes as US order). Anything else → null ("not generated").
 */
export function parseSettingDate(raw: string): Day | null {
  const v = raw.trim();
  let y: number;
  let m: number;
  let d: number;
  let match: RegExpMatchArray | null;
  if ((match = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = v.match(/^(\d{1,2})[.-](\d{1,2})[.-](\d{4})$/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m - 1)) return null;
  return day(y, m - 1, d);
}

// ------------------------------------------------------------------ slot planning

type Frequency = 'monthly' | 'quarterly' | 'half annually' | 'annually' | 'weekly' | 'daily';
const MONTH_STEPS: Partial<Record<Frequency, number>> = { monthly: 1, quarterly: 3, 'half annually': 6, annually: 12 };
const FREQUENCIES = new Set<string>(['monthly', 'quarterly', 'half annually', 'annually', 'weekly', 'daily']);

interface Slot {
  start: Day;
  end: Day;
  description: string;
}

function describe(text: string): string {
  return text.length > DESC_MAX ? text.slice(0, DESC_MAX) : text;
}

function* monthSlots(periodType: string, start: Day, until: Day, step: number, frequency: Frequency): Generator<Slot> {
  for (let k = 0; k < MAX_SLOTS_PER_TYPE; k++) {
    const s = addMonths(start, k * step);
    if (k > 0 && s > until) return;
    const e = addDays(addMonths(start, (k + 1) * step), -1);
    let description: string;
    if (frequency === 'annually') {
      const sy = s.getUTCFullYear();
      const ey = e.getUTCFullYear();
      description = sy === ey ? `${periodType} ${sy}` : `${periodType} ${sy} - ${ey}`;
    } else {
      description = `${periodType} ${MONTHS[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
    }
    yield { start: s, end: e, description: describe(description) };
  }
}

function* dailySlots(periodType: string, start: Day, until: Day): Generator<Slot> {
  for (let k = 0; k < MAX_SLOTS_PER_TYPE; k++) {
    const s = addDays(start, k);
    if (k > 0 && s > until) return;
    yield { start: s, end: s, description: describe(`${periodType} ${ymd(s)}`) };
  }
}

/** CI weekly: Monday–Sunday ISO weeks, clipped at the generation end, split at month ends. */
function* weeklySlots(periodType: string, start: Day, until: Day): Generator<Slot> {
  let s = start;
  for (let k = 0; k < MAX_SLOTS_PER_TYPE; k++) {
    if (k > 0 && s > until) return;
    const sunday = addDays(s, 7 - isoWeekday(s));
    let e = until >= s && until < sunday ? until : sunday;
    const { week, year } = isoWeek(s);
    const label = `${periodType} Week ${String(week).padStart(2, '0')}-${year}`;
    let suffix = '';
    if (e.getUTCMonth() !== s.getUTCMonth() || e.getUTCFullYear() !== s.getUTCFullYear()) {
      e = lastDayOfMonth(s);
      suffix = '(Part 1)';
    } else if (k > 0 && s.getUTCDate() === 1 && isoWeekday(s) !== 1) {
      suffix = '(Part 2)';
    }
    yield { start: s, end: e, description: describe(label + suffix) };
    s = addDays(e, 1);
  }
}

function slotsFor(frequency: Frequency, periodType: string, start: Day, until: Day): Generator<Slot> {
  const step = MONTH_STEPS[frequency];
  if (step) return monthSlots(periodType, start, until, step, frequency);
  if (frequency === 'weekly') return weeklySlots(periodType, start, until);
  return dailySlots(periodType, start, until);
}

// ------------------------------------------------------------------ service

interface ExistingPeriod {
  typeId: number;
  start: Day;
  end: Day;
}

interface TypeConfig {
  def: PeriodTypeDef;
  startRaw: string | null;
  frequencyRaw: string | null;
  typeId: number | null;
}

async function loadConfig(oaBrandId: number): Promise<TypeConfig[]> {
  return Promise.all(
    PERIOD_TYPES.map(async (def) => {
      const [startRaw, frequencyRaw, typeId] = await Promise.all([
        settingService.getValueOrDefault(def.startCode, oaBrandId),
        settingService.getValueOrDefault(def.frequencyCode, oaBrandId),
        getMasterId(def.typeCode),
      ]);
      return { def, startRaw, frequencyRaw, typeId };
    }),
  );
}

export async function generatePeriods(
  subject: RequestSubject,
  brand: ScopedBrand,
  now: Date = new Date(),
  /** Limit generation to these period type codes (period_mst "Syncronize Period"); default all. */
  options: { onlyTypeCodes?: readonly string[] } = {},
): Promise<PeriodGenerationResult> {
  const only = options.onlyTypeCodes ? new Set(options.onlyTypeCodes) : null;
  const [configs, statusId, verifyValue] = await Promise.all([
    loadConfig(brand.oaBrandId),
    getMasterId(STATUS_ACTIVE_CODE),
    settingService.getValue(VERIFY_SETTING_CODE, brand.oaBrandId),
  ]);
  const isVerified = verifyValue !== null && verifyValue !== '' && verifyValue !== '0';
  const current = today(now);
  const typeIds = configs.map((c) => c.typeId).filter((id): id is number => typeof id === 'number');

  await assertInsertSafe('period_mst', 'PERIOD_ID');

  const results = await prisma.$transaction(
    async (tx) => {
      const existingRows = typeIds.length
        ? await tx.period_mst.findMany({
            where: { OA_BRAND_ID: brand.oaBrandId, IS_DELETED: 0, PERIOD_TYPE_ID: { in: typeIds } },
            select: { PERIOD_TYPE_ID: true, PERIOD_START_DATE: true, PERIOD_END_DATE: true },
          })
        : [];
      const existing: ExistingPeriod[] = existingRows
        .filter((r) => r.PERIOD_TYPE_ID !== null && r.PERIOD_START_DATE && r.PERIOD_END_DATE)
        .map((r) => ({ typeId: r.PERIOD_TYPE_ID as number, start: r.PERIOD_START_DATE as Date, end: r.PERIOD_END_DATE as Date }));

      const covers = (typeId: number, d: Day) => existing.some((p) => p.typeId === typeId && p.start <= d && p.end >= d);
      const overlaps = (typeId: number, s: Day, e: Day) =>
        existing.some((p) => p.typeId === typeId && p.start <= e && p.end >= s);

      const out: PeriodTypeResult[] = [];
      const rows: Array<{
        PERIOD_START_DATE: Date;
        PERIOD_END_DATE: Date;
        PERIOD_TYPE_ID: number;
        FISCAL_PERIOD_DESC: string;
        PERIOD_STATUS_ID: number | null;
        IS_VERIFIED: boolean;
        OA_BRAND_ID: number;
        OA_ID: number;
        USER_ID: number;
        CREATED_BY: number;
        CREATED_ON: Date;
      }> = [];

      for (const { def, startRaw, frequencyRaw, typeId } of configs) {
        if (only && !only.has(def.typeCode)) continue;
        const type = def.periodType;
        const missing = [
          !startRaw ? 'start date' : null,
          !frequencyRaw ? 'frequency' : null,
          !typeId ? 'period type master' : null,
        ].filter(Boolean);
        if (missing.length || !startRaw || !frequencyRaw || !typeId) {
          out.push({ type, status: 'not_generated', count: 0, message: `Missing ${missing.join(', ')} setting.` });
          continue;
        }

        let start = parseSettingDate(startRaw);
        if (!start) {
          out.push({ type, status: 'not_generated', count: 0, message: `Start date "${startRaw}" is not a valid date.` });
          continue;
        }

        const frequency = frequencyRaw.trim().toLowerCase();
        if (!FREQUENCIES.has(frequency)) {
          out.push({ type, status: 'not_generated', count: 0, message: `Unsupported frequency "${frequencyRaw}".` });
          continue;
        }

        // CI checkAndGetAnotherYearDate (bounded).
        if (covers(typeId, start)) {
          let next: Day | null = null;
          let candidate = sameYearDate(start.getUTCFullYear() + 1, start);
          for (let i = 0; i < MAX_YEARS_AHEAD; i++) {
            if (!covers(typeId, candidate)) {
              next = candidate;
              break;
            }
            if (candidate.getUTCFullYear() >= current.getUTCFullYear()) break;
            candidate = sameYearDate(candidate.getUTCFullYear() + 1, candidate);
          }
          if (!next) {
            out.push({ type, status: 'exists', count: 0, message: 'Period already exists.' });
            continue;
          }
          start = next;
        }

        // End = anniversary of the start this year (next year when already reached) − 1 day.
        let anniversary = sameYearDate(current.getUTCFullYear(), start);
        if (anniversary <= current) anniversary = sameYearDate(current.getUTCFullYear() + 1, start);
        const until = addDays(anniversary, -1);

        let created = 0;
        let skipped = 0;
        for (const slot of slotsFor(frequency as Frequency, type, start, until)) {
          if (overlaps(typeId, slot.start, slot.end)) {
            skipped++;
            continue;
          }
          rows.push({
            PERIOD_START_DATE: slot.start,
            PERIOD_END_DATE: slot.end,
            PERIOD_TYPE_ID: typeId,
            FISCAL_PERIOD_DESC: slot.description,
            PERIOD_STATUS_ID: statusId,
            IS_VERIFIED: isVerified,
            OA_BRAND_ID: brand.oaBrandId,
            OA_ID: brand.oaId,
            USER_ID: subject.userId,
            CREATED_BY: subject.userId,
            CREATED_ON: now,
          });
          created++;
        }

        if (created > 0) {
          const range = `${ymd(start)} to ${ymd(until)}`;
          out.push({
            type,
            status: 'generated',
            count: created,
            message: `${created} period(s) generated (${range})${skipped ? `; ${skipped} already existed` : ''}.`,
          });
        } else {
          out.push({ type, status: 'exists', count: 0, message: 'Period already exists.' });
        }
      }

      if (rows.length > 50_000) {
        throw new BusinessRuleError('Too many periods would be generated at once. Check the start date settings.');
      }
      if (rows.length) await tx.period_mst.createMany({ data: rows });
      return out;
    },
    { timeout: 60_000 },
  );

  const namesBy = (status: PeriodResultStatus) => results.filter((r) => r.status === status).map((r) => r.type);
  const generated = namesBy('generated');
  const exists = namesBy('exists');
  const notGenerated = namesBy('not_generated');

  return {
    brand: { oaBrandId: brand.oaBrandId, name: brand.name },
    results,
    messages: {
      ...(generated.length ? { success: `Successfully Generated Period For ${generated.join(', ')}.` } : {}),
      ...(exists.length ? { warning: `Period Already Exists For ${exists.join(', ')}.` } : {}),
      ...(notGenerated.length ? { danger: `Could Not Generate Period For ${notGenerated.join(', ')}.` } : {}),
    },
  };
}

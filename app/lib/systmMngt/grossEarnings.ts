import { getDaysInYear, getISOWeek } from 'date-fns';
import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { BusinessRuleError } from '@/lib/http/errors';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { settingService } from '@/lib/settings/settingService';
import { activeBrand, authorize, brandOrgId, requireBrandAdmin } from './shared';

/**
 * CI systmMngt/gross_earnings_pay_distribution_config (one form: Annually / Monthly / Weekly / Daily
 * percentages of CTC per brand) and gross_earnings_pay_distribution_calc (CTC → amounts).
 * Sysadmin edits the system defaults (brand 0), everyone else the active brand.
 *
 * Behaviour changes: values must be whole numbers (the columns are integer — CI let anything
 * through and the database rejected it); saves stamp UPDATED_BY / CREATED_BY; Sync refuses when no
 * system default exists, copies ONE default row (the database holds two for brand 0, CI copied both)
 * and runs in one transaction; Sync is limited to brand admins on the server too.
 */

const MENU = 'systmMngt/gross_earnings_pay_distribution_config';
const KEYS = ['annually', 'monthly', 'weekly', 'daily'] as const;
type Key = (typeof KEYS)[number];
const LABELS: Record<Key, string> = { annually: 'Annually', monthly: 'Monthly', weekly: 'Weekly', daily: 'Daily' };

export interface GrossEarningsModel {
  title: string;
  values: Record<Key, string>;
  canSave: boolean;
  canSync: boolean;
}

export interface GrossPayResult {
  annually: number;
  monthly: number;
  weekly: number;
  daily: number;
  round_off_setting: number;
}

function targetBrand(subject: RequestSubject): number {
  return subject.adminLevel === 2 ? 0 : activeBrand(subject);
}

interface ConfigRow {
  ANNUALLY: number | null;
  MONTHLY: number | null;
  WEEKLY: number | null;
  DAILY: number | null;
}

// Raw SQL throughout: the table's audit columns are NULL in existing rows, while the Prisma model
// declares them required (Prisma would refuse to read those rows).

/** CI get*(brand): the brand's first row (CI had no ORDER BY; lowest id here, deterministic). */
async function configRow(brand: number | null): Promise<ConfigRow | null> {
  const where = brand === null ? Prisma.sql`("OA_BRAND_ID" = 0 OR "OA_BRAND_ID" IS NULL)` : Prisma.sql`"OA_BRAND_ID" = ${brand}`;
  const rows = await prisma.$queryRaw<ConfigRow[]>`
    SELECT "ANNUALLY", "MONTHLY", "WEEKLY", "DAILY" FROM gross_earnings_pay_distribution_config
    WHERE ${where} ORDER BY "GEPD_ID" LIMIT 1`;
  return rows[0] ?? null;
}

const wholeNumber = (label: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z
      .string({ error: `The ${label} field is required.` })
      .min(1, `The ${label} field is required.`)
      .regex(/^\d+$/, `The ${label} field must contain a whole number.`)
      .transform(Number),
  );

const saveSchema = z.object(Object.fromEntries(KEYS.map((k) => [k, wholeNumber(LABELS[k])])) as Record<Key, ReturnType<typeof wholeNumber>>);

/** PHP round($x, $precision): half away from zero. */
function phpRound(x: number, precision: number): number {
  const f = 10 ** precision;
  return (Math.sign(x) * Math.round(Math.abs(x) * f + Number.EPSILON)) / f;
}

export const grossEarningsService = {
  async load(subject: RequestSubject): Promise<GrossEarningsModel> {
    await authorize(subject, MENU, 'list');
    const row = await configRow(targetBrand(subject));
    const canUpdate = await menuPolicy(MENU).check(subject, 'update');
    return {
      title: 'Edit Gross Earnings Configuration',
      values: {
        annually: row?.ANNUALLY?.toString() ?? '',
        monthly: row?.MONTHLY?.toString() ?? '',
        weekly: row?.WEEKLY?.toString() ?? '',
        daily: row?.DAILY?.toString() ?? '',
      },
      canSave: canUpdate,
      canSync: subject.adminLevel === 1 && canUpdate,
    };
  },

  /** CI update(): update the brand's row(s), or insert one. */
  async save(subject: RequestSubject, body: unknown): Promise<{ message: string }> {
    await authorize(subject, MENU, 'update');
    const input = saveSchema.parse(body);
    const brand = targetBrand(subject);
    const { annually, monthly, weekly, daily } = input;
    const updated = await prisma.$executeRaw`
      UPDATE gross_earnings_pay_distribution_config
      SET "ANNUALLY" = ${annually}, "MONTHLY" = ${monthly}, "WEEKLY" = ${weekly}, "DAILY" = ${daily},
          "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
      WHERE "OA_BRAND_ID" = ${brand}`;
    if (updated === 0) {
      await assertInsertSafe('gross_earnings_pay_distribution_config', 'GEPD_ID');
      const oaId = brand === 0 ? 0 : await brandOrgId(brand, subject.oaId);
      await prisma.$executeRaw`
        INSERT INTO gross_earnings_pay_distribution_config
          ("ANNUALLY", "MONTHLY", "WEEKLY", "DAILY", "OA_BRAND_ID", "OA_ID", "USER_ID", "CREATED_BY", "CREATED_ON")
        VALUES (${annually}, ${monthly}, ${weekly}, ${daily}, ${brand}, ${oaId}, ${subject.userId}, ${subject.userId}, now())`;
    }
    return { message: 'Successfully Updated Gross Earnings Configuration' };
  },

  /** CI syncDefault(): replace the brand's configuration with the system default (brand 0 / NULL). */
  async sync(subject: RequestSubject): Promise<{ message: string }> {
    await authorize(subject, MENU, 'update');
    requireBrandAdmin(subject);
    const brand = activeBrand(subject);
    const source = await configRow(null);
    if (!source) throw new BusinessRuleError('No system default gross earnings configuration exists to sync from.', 'NO_DEFAULTS');
    await assertInsertSafe('gross_earnings_pay_distribution_config', 'GEPD_ID');
    const oaId = await brandOrgId(brand, subject.oaId);
    await prisma.$transaction([
      prisma.$executeRaw`DELETE FROM gross_earnings_pay_distribution_config WHERE "OA_BRAND_ID" = ${brand}`,
      prisma.$executeRaw`
        INSERT INTO gross_earnings_pay_distribution_config
          ("ANNUALLY", "MONTHLY", "WEEKLY", "DAILY", "OA_ID", "OA_BRAND_ID", "USER_ID", "CREATED_BY", "CREATED_ON")
        VALUES (${source.ANNUALLY}, ${source.MONTHLY}, ${source.WEEKLY}, ${source.DAILY}, ${oaId}, ${brand},
                ${subject.userId}, ${subject.userId}, now())`,
    ]);
    return { message: 'Successfully Updated Synced Module' };
  },

  /**
   * CI gross_earnings_pay_distribution_calc::calculateGrossPay($ctc): each configured percentage of
   * CTC, spread over the year (12 months, the ISO weeks of the year, its days), rounded to the brand's
   * "Net Pay Rounding Off" setting (OASANPROF, 0 when unset). Behaviour change: a non-numeric CTC is
   * a validation error (CI treated it as 0 or crashed).
   */
  async calculate(subject: RequestSubject, rawCtc: string, now: Date = new Date()): Promise<GrossPayResult> {
    await authorize(subject, MENU, 'list');
    const ctc = Number(rawCtc);
    if (!rawCtc.trim() || !Number.isFinite(ctc)) {
      throw new BusinessRuleError('The CTC field must contain a number.', 'INVALID_CTC', { ctc: ['The CTC field must contain a number.'] });
    }
    const brand = targetBrand(subject);
    const [row, rounding] = await Promise.all([configRow(brand), settingService.getValue('OASANPROF', brand)]);
    const r = Math.max(0, Math.trunc(Number(rounding) || 0));

    const year = now.getFullYear();
    // CI: date('W', Dec 31), or of Dec 24 when Dec 31 already falls in week 1 of the next year.
    const lastWeek = getISOWeek(new Date(year, 11, 31));
    const weekCount = lastWeek === 1 ? getISOWeek(new Date(year, 11, 24)) : lastWeek;
    const dayCount = getDaysInYear(new Date(year, 0, 1));
    const share = (pct: number | null) => (pct ?? 0) * (ctc / 100);

    return {
      annually: phpRound(share(row?.ANNUALLY ?? null), r),
      monthly: phpRound(share(row?.MONTHLY ?? null) / 12, r),
      weekly: phpRound(share(row?.WEEKLY ?? null) / weekCount, r),
      daily: phpRound(share(row?.DAILY ?? null) / dayCount, r),
      round_off_setting: r,
    };
  },
};

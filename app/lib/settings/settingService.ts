import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';

/**
 * Per-brand settings (CI setting_manager): group → section header → attribute → brand answer.
 *
 * Ports two CI readers against the base tables (the *_vw views were not migrated):
 *  - usernamerules_m::getAllRulesByOrgID(brand, groups) → { attributeCode: value }
 *  - setting_group_attribute_mst_m::getSettingAttributeValue(code, brand)
 *
 * Value rule (identical to CI): a TextBox attribute's answer is the raw text stored in
 * oa_brand_setting_attribute_mst.SETTING_ATTRIBUTE_OPTIONS_ID; any other input type stores an
 * option id whose label is independent_mst.MSTR_NM of the option's SYSTEM_SETTING_ATTRIBUTE_VALUE_ID
 * ("Yes", "Day", …). An option id that does not resolve yields null (CI: no value → rule off).
 * Rows are read oldest→newest so the latest answer wins, as in CI.
 */

const TEXTBOX_INPUT_CODE = 'SIOTT';

let textboxTypeId: number | null | undefined;
async function getTextboxTypeId(): Promise<number | null> {
  if (textboxTypeId !== undefined) return textboxTypeId;
  const row = await prisma.independent_mst.findFirst({
    where: { MSTR_CD: TEXTBOX_INPUT_CODE },
    select: { MSTR_ID: true },
    orderBy: { MSTR_ID: 'asc' },
  });
  textboxTypeId = row?.MSTR_ID ?? null;
  return textboxTypeId;
}

interface AnswerRow {
  code: string;
  input_type: number | null;
  raw: string | null;
  label: string | null;
}

async function readAnswers(where: Prisma.Sql): Promise<AnswerRow[]> {
  return prisma.$queryRaw<AnswerRow[]>`
    SELECT im."MSTR_CD" AS code, sgam."INPUT_OPTION_TYPE_ID" AS input_type,
           b."SETTING_ATTRIBUTE_OPTIONS_ID" AS raw, vim."MSTR_NM" AS label
    FROM oa_brand_setting_attribute_mst b
    JOIN setting_group_attribute_mst sgam ON sgam."SETTING_ATTRIBUTE_ID" = b."SETTING_ATTRIBUTE_ID"
    JOIN independent_mst im ON im."MSTR_ID" = sgam."SYSTEM_SETTING_ATTRIBUTE_ID"
    JOIN setting_group_section_header_mst h ON h."SETTING_GROUP_SECTION_HEADER_ID" = sgam."SETTING_GROUP_SECTION_HEADER_ID"
    JOIN setting_group_mst sgm ON sgm."SETTING_GROUP_ID" = h."SETTING_GROUP_ID"
    JOIN independent_mst gim ON gim."MSTR_ID" = sgm."SETTING_GROUP_NAME_ID"
    LEFT JOIN "setting_group_attribute_Value_mst" v
      ON v."SETTING_ATTRIBUTE_OPTIONS_ID" =
         (CASE WHEN b."SETTING_ATTRIBUTE_OPTIONS_ID" ~ '^[0-9]+$' THEN b."SETTING_ATTRIBUTE_OPTIONS_ID"::int END)
    LEFT JOIN independent_mst vim ON vim."MSTR_ID" = v."SYSTEM_SETTING_ATTRIBUTE_VALUE_ID"
    WHERE ${where} AND sgam."IS_DELETED" = 0
    ORDER BY b."OA_BRAND_SETTING_ATTRIBUTE_ID" ASC`;
}

async function toValueMap(rows: AnswerRow[]): Promise<Record<string, string | null>> {
  const textbox = await getTextboxTypeId();
  const result: Record<string, string | null> = {};
  for (const r of rows) {
    result[r.code] = r.input_type === textbox ? r.raw : r.label;
  }
  return result;
}

export const settingService = {
  /** CI getAllRulesByOrgID: every attribute of the given setting groups for one brand. */
  async getGroupValues(oaBrandId: number, groupCodes: string[]): Promise<Record<string, string | null>> {
    if (!groupCodes.length) return {};
    const rows = await readAnswers(
      Prisma.sql`gim."MSTR_CD" IN (${Prisma.join(groupCodes)}) AND b."OA_BRAND_ID" = ${oaBrandId} AND sgm."IS_DELETED" = 0`,
    );
    return toValueMap(rows);
  },

  /** CI getSettingAttributeValue(code, brand): single attribute; brand 0 = system default. */
  async getValue(code: string, oaBrandId: number): Promise<string | null> {
    const rows = await readAnswers(Prisma.sql`im."MSTR_CD" = ${code} AND b."OA_BRAND_ID" = ${oaBrandId}`);
    const map = await toValueMap(rows);
    return map[code] ?? null;
  },

  /** Brand value, falling back to the system default (brand 0), then to `fallback`. */
  async getValueOrDefault(code: string, oaBrandId: number | null, fallback: string | null = null): Promise<string | null> {
    if (oaBrandId) {
      const v = await this.getValue(code, oaBrandId);
      if (v !== null && v !== '') return v;
    }
    const d = await this.getValue(code, 0);
    return d !== null && d !== '' ? d : fallback;
  },
};

/** CI "yes"/"no" settings, compared case-insensitively. */
export function isYes(value: string | null | undefined): boolean {
  return (value ?? '').trim().toLowerCase() === 'yes';
}

/** Numeric setting (textbox); empty / non-numeric → 0 like PHP's (int) cast. */
export function toNumber(value: string | null | undefined): number {
  const n = Number((value ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

/** CI $minutes_arr — with Day corrected to 1440 (CI used 1400). Unknown unit → 0 (rule off), as in CI. */
const MINUTES_PER_UNIT: Record<string, number> = {
  minute: 1,
  hour: 60,
  day: 1440,
  week: 10080,
  month: 43800,
  year: 525600,
};

export function periodToMinutes(amount: string | null | undefined, unit: string | null | undefined): number {
  const perUnit = MINUTES_PER_UNIT[(unit ?? '').trim().toLowerCase()] ?? 0;
  return toNumber(amount) * perUnit;
}

/** Whole minutes elapsed since `from` (CI date_diff ignoring seconds). */
export function minutesSince(from: Date | null | undefined, now: Date = new Date()): number {
  if (!from) return 0;
  return Math.floor((now.getTime() - from.getTime()) / 60000);
}

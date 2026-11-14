import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { SqlBuilder } from '@/lib/employeeMngt/empList';
import { Checks, isDate, masterName, str } from '@/lib/employeeMngt/hub/hubEngine';
import { keepCurrent, masterLabel, periodLabel } from '@/lib/employeeMngt/hub/hubOptions';
import { NotFoundError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { columnSearchConditions } from '@/lib/resource/columnSearch';
import { parseListQuery } from '@/lib/resource/listQuery';
import type { ListResult, ResourcePermissions } from '@/lib/resource/types';
import { activeBrand, brandOrgId, parseId, type IdLabel } from '@/lib/systmMngt/shared';
import { form16Permissions, periodOptions, quarterOptions, requireForm16 } from './shared';

/**
 * CI form16/form16_quarter_settings ("Form-16 Quarter Settings Detail"): a brand's quarters of a financial year —
 * financial year, quarter, start and end date (table form16_quarter_settings, list form16_quarter_settings_vw). CI
 * had no menu entry for it (reached by URL from Form 16); the form16/form16 grant governs it.
 * List scoping as CI getTableDtl: system admin every brand, brand admin the brand, a normal user the rows they saved.
 *
 * Behaviour changes: every field is required (CI's rules were "trim" only, but the columns are NOT NULL — its MySQL
 * stored 0 / zero dates) and the end date may not be before the start date; a quarter can be set once per financial
 * year and brand; the financial years are the brand's (CI listed every brand's); a record keeps its brand on edit
 * (CI moved it to the editor's session brand); delete is soft (CI hard-deleted).
 */

export interface QuarterSettingValues {
  FINANCIAL_YEAR_ID: string;
  QUARTER_ID: string;
  START_DATE: string;
  END_DATE: string;
}

export interface QuarterSettingFormModel {
  options: { financialYears: IdLabel[]; quarters: IdLabel[] };
  canSave: boolean;
  missingMasters: string[];
}

const LIST_COLUMNS = `t."FORM16_QUARTER_SETTINGS_ID" AS id, t."FORM16_QUARTER_SETTINGS_ID", t."FINANCIAL_YEAR_ID",
  (SELECT btrim(regexp_replace(p."FISCAL_PERIOD_DESC", '\\s+', ' ', 'g')) FROM period_mst p WHERE p."PERIOD_ID" = t."FINANCIAL_YEAR_ID" LIMIT 1) AS "FINANCIAL_YEAR_NM",
  t."QUARTER_ID", ${masterName('t."QUARTER_ID"')} AS "QUARTER_NM",
  to_char(t."START_DATE", 'YYYY-MM-DD') AS "START_DATE", to_char(t."END_DATE", 'YYYY-MM-DD') AS "END_DATE",
  t."OA_ID", t."OA_BRAND_ID", t."USER_ID",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = t."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD"`;

const SEARCHABLE = ['FINANCIAL_YEAR_NM', 'QUARTER_NM', 'START_DATE', 'END_DATE', 'OA_BRAND_CD'];
const SORTABLE = ['id', 'FORM16_QUARTER_SETTINGS_ID', 'FINANCIAL_YEAR_ID', 'QUARTER_ID', 'OA_ID', 'USER_ID', ...SEARCHABLE];

/** CI getTableDtl(OA_BRAND_ID, USER_ID) on table alias t. */
function scope(subject: RequestSubject, sql: SqlBuilder): string {
  if (subject.adminLevel === 2) return 'TRUE';
  if (subject.adminLevel === 1) return `t."OA_BRAND_ID" = ${sql.p(subject.oaBrandId ?? -1)}::int`;
  return `t."USER_ID" = ${sql.p(subject.userId)}::int`;
}

async function findRow(subject: RequestSubject, id: number): Promise<Record<string, unknown>> {
  const sql = new SqlBuilder();
  const [row] = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT ${LIST_COLUMNS} FROM form16_quarter_settings t
     WHERE t."FORM16_QUARTER_SETTINGS_ID" = ${sql.p(id)}::int AND t."IS_DELETED" = 0 AND ${scope(subject, sql)} LIMIT 1`,
    ...sql.params,
  );
  if (!row) throw new NotFoundError('Record not found.');
  return row;
}

function toValues(row: Record<string, unknown>): QuarterSettingValues {
  const id = (v: unknown) => (str(v) === '0' ? '' : str(v));
  return { FINANCIAL_YEAR_ID: id(row.FINANCIAL_YEAR_ID), QUARTER_ID: id(row.QUARTER_ID), START_DATE: str(row.START_DATE), END_DATE: str(row.END_DATE) };
}

const bodySchema = z.record(z.string(), z.unknown());
const parseBody = (body: unknown): QuarterSettingValues => {
  const raw = bodySchema.parse(body ?? {});
  return { FINANCIAL_YEAR_ID: str(raw.FINANCIAL_YEAR_ID), QUARTER_ID: str(raw.QUARTER_ID), START_DATE: str(raw.START_DATE), END_DATE: str(raw.END_DATE) };
};

async function validate(v: QuarterSettingValues, brand: number, id: number | null, existing: QuarterSettingValues | null): Promise<void> {
  const check = new Checks();
  const labels: Record<keyof QuarterSettingValues, string> = { FINANCIAL_YEAR_ID: 'Financial Year', QUARTER_ID: 'Quarter', START_DATE: 'Start Date', END_DATE: 'End Date' };
  for (const [field, label] of Object.entries(labels) as Array<[keyof QuarterSettingValues, string]>) {
    if (!v[field]) check.fail(field, `The ${label} field is required.`);
  }
  for (const field of ['START_DATE', 'END_DATE'] as const) {
    if (v[field] && !isDate(v[field])) check.fail(field, `The ${labels[field]} field must be a valid date.`);
  }
  if (!check.has('START_DATE') && !check.has('END_DATE') && v.START_DATE && v.END_DATE && v.END_DATE < v.START_DATE) {
    check.fail('END_DATE', 'The End Date cannot be before the Start Date.');
  }
  const [years, quarters] = await Promise.all([periodOptions('OPTFY', brand), quarterOptions()]);
  if (v.FINANCIAL_YEAR_ID && !years.some((o) => String(o.value) === v.FINANCIAL_YEAR_ID) && v.FINANCIAL_YEAR_ID !== existing?.FINANCIAL_YEAR_ID) {
    check.fail('FINANCIAL_YEAR_ID', 'Select a valid Financial Year.');
  }
  if (v.QUARTER_ID && !quarters.some((o) => String(o.value) === v.QUARTER_ID) && v.QUARTER_ID !== existing?.QUARTER_ID) {
    check.fail('QUARTER_ID', 'Select a valid Quarter.');
  }
  if (!check.has('FINANCIAL_YEAR_ID') && !check.has('QUARTER_ID') && v.FINANCIAL_YEAR_ID && v.QUARTER_ID) {
    const [dup] = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT "FORM16_QUARTER_SETTINGS_ID" AS id FROM form16_quarter_settings
      WHERE "OA_BRAND_ID" = ${brand} AND "FINANCIAL_YEAR_ID" = ${Number(v.FINANCIAL_YEAR_ID)} AND "QUARTER_ID" = ${Number(v.QUARTER_ID)}
        AND "IS_DELETED" = 0 AND "FORM16_QUARTER_SETTINGS_ID" <> ${id ?? -1}
      LIMIT 1`;
    if (dup) check.fail('QUARTER_ID', 'This quarter is already set for the financial year.');
  }
  check.throwIfAny();
}

export const form16QuarterSettingsService = {
  permissions: (subject: RequestSubject): Promise<ResourcePermissions> => form16Permissions(subject),

  /** CI index() (listview_v over form16_quarter_settings_vw). */
  async list(subject: RequestSubject, rawQuery: Record<string, string>): Promise<ListResult<Record<string, unknown>> & { permissions: ResourcePermissions }> {
    await requireForm16(subject, 'list');
    const query = parseListQuery(rawQuery);
    const sql = new SqlBuilder();
    const where = scope(subject, sql);
    const filters: string[] = [];
    if (query.search) {
      const term = sql.p(`%${query.search}%`);
      filters.push(`(${SEARCHABLE.map((c) => `v."${c}"::text ILIKE ${term}`).join(' OR ')})`);
    }
    filters.push(...columnSearchConditions(rawQuery, SEARCHABLE, (x) => sql.p(x)));
    const sort = query.sort && SORTABLE.includes(query.sort) ? `v."${query.sort}" ${query.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, v.id DESC` : 'v.id DESC';
    const from = `(SELECT ${LIST_COLUMNS} FROM form16_quarter_settings t WHERE t."IS_DELETED" = 0 AND ${where}) v ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}`;
    const [rows, count, permissions] = await Promise.all([
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM ${from} ORDER BY ${sort} LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`, ...sql.params),
      prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM ${from}`, ...sql.params),
      form16Permissions(subject),
    ]);
    return { rows: rows.map((r) => ({ ...r, id: Number(r.id) })), total: count[0]?.n ?? 0, page: query.page, limit: query.limit, permissions };
  },

  /** CI initForm: the brand's financial years and the quarters. */
  async form(subject: RequestSubject, rawQuery: Record<string, string>): Promise<QuarterSettingFormModel> {
    await requireForm16(subject, 'list');
    const row = rawQuery.id ? await findRow(subject, parseId(rawQuery.id)) : null;
    const brand = row ? Number(row.OA_BRAND_ID) : activeBrand(subject);
    const [years, quarters, canSave] = await Promise.all([
      periodOptions('OPTFY', brand),
      quarterOptions(),
      requireForm16(subject, row ? 'update' : 'create').then(() => true, () => false),
    ]);
    return {
      options: {
        financialYears: (await keepCurrent(years, row?.FINANCIAL_YEAR_ID, periodLabel)) as IdLabel[],
        quarters: (await keepCurrent(quarters, row?.QUARTER_ID, masterLabel)) as IdLabel[],
      },
      canSave,
      missingMasters: quarters.length ? [] : ['Quarters (master type SYSQUA)'],
    };
  },

  async get(subject: RequestSubject, rawId: string): Promise<QuarterSettingValues> {
    await requireForm16(subject, 'list');
    return toValues(await findRow(subject, parseId(rawId)));
  },

  /** CI insert(): the active brand's, saved by the caller. */
  async create(subject: RequestSubject, body: unknown): Promise<{ id: number; message: string }> {
    await requireForm16(subject, 'create');
    const brand = activeBrand(subject);
    const v = parseBody(body);
    await validate(v, brand, null, null);
    await assertInsertSafe('form16_quarter_settings', 'FORM16_QUARTER_SETTINGS_ID');
    const oaId = await brandOrgId(brand, subject.oaId);
    const [row] = await prisma.$queryRaw<Array<{ id: number }>>`
      INSERT INTO form16_quarter_settings ("FINANCIAL_YEAR_ID", "QUARTER_ID", "START_DATE", "END_DATE", "OA_ID", "OA_BRAND_ID", "USER_ID",
        "CREATED_BY", "CREATED_ON", "UPDATED_BY", "UPDATED_ON", "IS_DELETED")
      VALUES (${Number(v.FINANCIAL_YEAR_ID)}, ${Number(v.QUARTER_ID)}, ${v.START_DATE}::date, ${v.END_DATE}::date, ${oaId}, ${brand}, ${subject.userId},
        ${String(subject.userId)}, now(), ${String(subject.userId)}, now(), 0)
      RETURNING "FORM16_QUARTER_SETTINGS_ID" AS id`;
    return { id: Number(row.id), message: 'Successfully Added Form-16 Quarter Details' };
  },

  /** CI update($id). */
  async update(subject: RequestSubject, rawId: string, body: unknown): Promise<{ id: number; message: string }> {
    await requireForm16(subject, 'update');
    const id = parseId(rawId);
    const row = await findRow(subject, id);
    const v = parseBody(body);
    await validate(v, Number(row.OA_BRAND_ID), id, toValues(row));
    await prisma.$executeRaw`
      UPDATE form16_quarter_settings SET "FINANCIAL_YEAR_ID" = ${Number(v.FINANCIAL_YEAR_ID)}, "QUARTER_ID" = ${Number(v.QUARTER_ID)},
        "START_DATE" = ${v.START_DATE}::date, "END_DATE" = ${v.END_DATE}::date, "UPDATED_BY" = ${String(subject.userId)}, "UPDATED_ON" = now()
      WHERE "FORM16_QUARTER_SETTINGS_ID" = ${id}`;
    // CI's update message (copied from the Form 16 controller).
    return { id, message: 'Successfully Updated Form-16 Details' };
  },

  /** CI delete($id) — soft here. */
  async remove(subject: RequestSubject, rawId: string): Promise<{ id: number; message: string }> {
    await requireForm16(subject, 'delete');
    const id = parseId(rawId);
    await findRow(subject, id);
    await prisma.$executeRaw`
      UPDATE form16_quarter_settings SET "IS_DELETED" = 1, "UPDATED_BY" = ${String(subject.userId)}, "UPDATED_ON" = now() WHERE "FORM16_QUARTER_SETTINGS_ID" = ${id}`;
    return { id, message: 'Successfully Deleted' };
  },
};

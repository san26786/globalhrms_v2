import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { SqlBuilder } from '@/lib/employeeMngt/empList';
import { asId, Checks, fullName, isDate, masterName, scopeSql, str } from '@/lib/employeeMngt/hub/hubEngine';
import { keepCurrent, masterLabel } from '@/lib/employeeMngt/hub/hubOptions';
import { NotFoundError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { columnSearchConditions } from '@/lib/resource/columnSearch';
import { parseListQuery } from '@/lib/resource/listQuery';
import type { ListResult, ResourcePermissions } from '@/lib/resource/types';
import { parseId, type IdLabel } from '@/lib/systmMngt/shared';
import { form16InScope, form16Options, form16Permissions, oltasOptions, quarterOptions, requireForm16 } from './shared';

/**
 * CI form16/form16_quarters ("Form-16 Quarters"): the quarter-wise TDS lines of a Form 16 — quarter, receipt number of
 * the quarterly TDS statement, amount paid, tax deducted, and the challan (BSR code, deposit date, challan serial
 * number, OLTAS status). Reached from the Form 16 edit form ("Add Items" / row edit / delete, CI tableActions) and
 * as its own list. A quarter belongs to its Form 16: it is listed, read and changed only when that Form 16 is in the
 * caller's scope (CI getTableDtl / form16 rules), under the form16/form16 menu grant.
 *
 * CI rules kept: every field is required; a quarter cannot repeat within a Form 16 ("This Quarter cannot be Repeat",
 * CI check_quarter); saving from a Form 16 returns to it, from the list to the list; "Save And Add" opens a new
 * quarter for the same Form 16.
 * Behaviour changes: the repeat check skips the quarter being edited (CI's failed every edit that kept the quarter)
 * and deleted rows; a quarter added from the list picks its Form 16 (CI saved it with none, FORM16_ID 0); the Form 16
 * of a quarter does not change on edit; Amount / Amount Tax must be whole rupees (integer columns — CI's MySQL
 * truncated); delete is soft (CI hard-deleted); OA_ID / OA_BRAND_ID / USER_ID are the Form 16's (CI: the session's).
 * The list also shows the employee (CI showed only the Form16 Id). PERIOD_ID stays 0 as CI wrote it; the list's
 * Period shows the Form 16's when the form16 table has that column.
 */

export interface QuarterValues {
  FORM16_ID: string;
  QUARTERS_ID: string;
  RECEIPT_NO: string;
  AMOUNT: string;
  AMOUNT_TAX: string;
  BSR_CODE: string;
  TAX_DATE: string;
  CHALLAN_SL_NO: string;
  OLTAS_STATUS: string;
}

export interface QuarterFormModel {
  options: { quarters: IdLabel[]; oltas: IdLabel[]; form16s: IdLabel[] };
  /** The Form 16 the quarter is for (edit, or add from a Form 16) — fixed on the form. */
  form16: { id: number; label: string } | null;
  canSave: boolean;
  /** No quarter / OLTAS masters exist (master types SYSQUA / SYSOLT). */
  missingMasters: string[];
}

const FROM = `form16_quarters q
  JOIN form16 f ON f."FORM16_ID" = q."FORM16_ID" AND f."IS_DELETED" = 0
  JOIN emp_mst em ON em."EMP_ID" = f."EMP_ID" AND em."IS_DELETED" = 0`;

const periodName = (expr: string) =>
  `(SELECT btrim(regexp_replace(p."FISCAL_PERIOD_DESC", '\\s+', ' ', 'g')) FROM period_mst p WHERE p."PERIOD_ID" = ${expr} LIMIT 1)`;

const LIST_COLUMNS = `q."FORM16_QUARTERS_ID" AS id, q."FORM16_ID", em."EMP_ID" AS "EMPLOYEE_ID", em."EMP_NBR", ${fullName('em')} AS "EMP_FULL_NAME",
  COALESCE(${periodName('NULLIF(q."PERIOD_ID", 0)')}, ${periodName(asId(`to_jsonb(f) ->> 'PERIOD_ID'`))}) AS "PERIOD_NM",
  q."QUARTERS_ID", ${masterName('q."QUARTERS_ID"')} AS "QUARTERS_NM", q."RECEIPT_NO", q."AMOUNT", q."AMOUNT_TAX", q."BSR_CODE",
  to_char(q."TAX_DATE", 'YYYY-MM-DD') AS "TAX_DATE", q."CHALLAN_SL_NO", q."OLTAS_STATUS", ${masterName('q."OLTAS_STATUS"')} AS "OLTAS_STATUS_NM",
  (SELECT b."OA_BRAND_CD" FROM oa_brands b WHERE b."OA_BRAND_ID" = em."OA_BRAND_ID" LIMIT 1) AS "OA_BRAND_CD"`;

const SEARCHABLE = ['FORM16_ID', 'EMP_NBR', 'EMP_FULL_NAME', 'PERIOD_NM', 'QUARTERS_NM', 'RECEIPT_NO', 'AMOUNT', 'AMOUNT_TAX', 'BSR_CODE', 'TAX_DATE', 'CHALLAN_SL_NO', 'OLTAS_STATUS_NM', 'OA_BRAND_CD'];
const SORTABLE = ['id', ...SEARCHABLE];

/** A Form 16's quarter rows in the order CI's child table and the PDF show them. */
export const QUARTER_ORDER = `v."FORM16_ID" DESC, v."QUARTERS_NM" ASC NULLS LAST, v.id ASC`;

async function scoped(subject: RequestSubject, sql: SqlBuilder): Promise<string> {
  return `q."IS_DELETED" = 0 AND ${await scopeSql(subject, sql)}`;
}

async function findQuarter(subject: RequestSubject, id: number): Promise<Record<string, unknown>> {
  const sql = new SqlBuilder();
  const where = await scoped(subject, sql);
  const [row] = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT ${LIST_COLUMNS} FROM ${FROM} WHERE q."FORM16_QUARTERS_ID" = ${sql.p(id)}::int AND ${where} LIMIT 1`,
    ...sql.params,
  );
  if (!row) throw new NotFoundError('Record not found.');
  return row;
}

const plain = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v instanceof Date ? v.toISOString().slice(0, 10) : v]));

function toValues(row: Record<string, unknown>): QuarterValues {
  const id = (v: unknown) => (str(v) === '0' ? '' : str(v));
  return {
    FORM16_ID: str(row.FORM16_ID),
    QUARTERS_ID: id(row.QUARTERS_ID),
    RECEIPT_NO: str(row.RECEIPT_NO),
    AMOUNT: str(row.AMOUNT),
    AMOUNT_TAX: str(row.AMOUNT_TAX),
    BSR_CODE: str(row.BSR_CODE),
    TAX_DATE: str(row.TAX_DATE).slice(0, 10),
    CHALLAN_SL_NO: str(row.CHALLAN_SL_NO),
    OLTAS_STATUS: id(row.OLTAS_STATUS),
  };
}

const bodySchema = z.record(z.string(), z.unknown());

function parseBody(body: unknown): QuarterValues {
  const raw = bodySchema.parse(body ?? {});
  const v = (k: keyof QuarterValues) => str(raw[k]).slice(0, 4000);
  return {
    FORM16_ID: v('FORM16_ID'),
    QUARTERS_ID: v('QUARTERS_ID'),
    RECEIPT_NO: v('RECEIPT_NO'),
    AMOUNT: v('AMOUNT'),
    AMOUNT_TAX: v('AMOUNT_TAX'),
    BSR_CODE: v('BSR_CODE'),
    TAX_DATE: v('TAX_DATE'),
    CHALLAN_SL_NO: v('CHALLAN_SL_NO'),
    OLTAS_STATUS: v('OLTAS_STATUS'),
  };
}

/** CI form16_quarters::setFormValidationRules + check_quarter. */
async function validate(v: QuarterValues, form16Id: number, quarterId: number | null, existing: QuarterValues | null): Promise<void> {
  const check = new Checks();
  const required: Array<[keyof QuarterValues, string]> = [
    ['QUARTERS_ID', 'Quarters'],
    ['RECEIPT_NO', 'Receipt No'],
    ['AMOUNT', 'Amount'],
    ['AMOUNT_TAX', 'Amount Tax'],
    ['BSR_CODE', 'BSR Code'],
    ['TAX_DATE', 'Tax Date'],
    ['CHALLAN_SL_NO', 'Challan SL No'],
    ['OLTAS_STATUS', 'OLTAS Status'],
  ];
  for (const [field, label] of required) if (!v[field]) check.fail(field, `The ${label} field is required.`);
  for (const [field, label] of [['RECEIPT_NO', 'Receipt No'], ['BSR_CODE', 'BSR Code'], ['CHALLAN_SL_NO', 'Challan SL No']] as const) {
    if (v[field].length > 255) check.fail(field, `The ${label} field cannot exceed 255 characters in length.`);
  }
  for (const [field, label] of [['AMOUNT', 'Amount'], ['AMOUNT_TAX', 'Amount Tax']] as const) {
    if (v[field] && !check.has(field) && (!/^\d{1,10}$/.test(v[field]) || Number(v[field]) > 2147483647)) {
      check.fail(field, `The ${label} field must be a whole number of rupees.`);
    }
  }
  if (v.TAX_DATE && !isDate(v.TAX_DATE)) check.fail('TAX_DATE', 'The Tax Date field must be a valid date.');

  const [quarters, oltas] = await Promise.all([quarterOptions(), oltasOptions()]);
  const known = (list: IdLabel[], value: string, stored: string | undefined) => list.some((o) => String(o.value) === value) || value === stored;
  if (v.QUARTERS_ID && !check.has('QUARTERS_ID') && !known(quarters, v.QUARTERS_ID, existing?.QUARTERS_ID)) check.fail('QUARTERS_ID', 'Select a valid Quarters.');
  if (v.OLTAS_STATUS && !check.has('OLTAS_STATUS') && !known(oltas, v.OLTAS_STATUS, existing?.OLTAS_STATUS)) check.fail('OLTAS_STATUS', 'Select a valid OLTAS Status.');

  if (v.QUARTERS_ID && !check.has('QUARTERS_ID')) {
    const [dup] = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT "FORM16_QUARTERS_ID" AS id FROM form16_quarters
      WHERE "FORM16_ID" = ${form16Id} AND "QUARTERS_ID" = ${Number(v.QUARTERS_ID)} AND "IS_DELETED" = 0
        AND "FORM16_QUARTERS_ID" <> ${quarterId ?? -1}
      LIMIT 1`;
    if (dup) check.fail('QUARTERS_ID', 'This Quarter cannot be Repeat');
  }
  check.throwIfAny();
}

async function requireParent(subject: RequestSubject, raw: string, field = 'FORM16_ID') {
  const id = Number(raw);
  const parent = Number.isInteger(id) && id > 0 ? await form16InScope(subject, id) : null;
  if (!parent) {
    const check = new Checks();
    check.fail(field, raw ? 'Select a valid Form-16.' : 'The Form-16 field is required.');
    check.throwIfAny();
  }
  return parent!;
}

export const form16QuartersService = {
  permissions: (subject: RequestSubject): Promise<ResourcePermissions> => form16Permissions(subject),

  /** CI index() (listview_v over form16_quarters_vw); `?form16=` narrows to one Form 16 (its edit form's table). */
  async list(subject: RequestSubject, rawQuery: Record<string, string>): Promise<ListResult<Record<string, unknown>> & { permissions: ResourcePermissions }> {
    await requireForm16(subject, 'list');
    const query = parseListQuery(rawQuery);
    const sql = new SqlBuilder();
    const where = [await scoped(subject, sql)];
    const parent = Number(rawQuery.form16);
    if (Number.isInteger(parent) && parent > 0) where.push(`q."FORM16_ID" = ${sql.p(parent)}::int`);
    const filters: string[] = [];
    if (query.search) {
      const term = sql.p(`%${query.search}%`);
      filters.push(`(${SEARCHABLE.map((c) => `v."${c}"::text ILIKE ${term}`).join(' OR ')})`);
    }
    filters.push(...columnSearchConditions(rawQuery, SEARCHABLE, (x) => sql.p(x)));
    const sort = query.sort && SORTABLE.includes(query.sort) ? `v."${query.sort}" ${query.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, v.id DESC` : QUARTER_ORDER;
    const from = `(SELECT ${LIST_COLUMNS} FROM ${FROM} WHERE ${where.join(' AND ')}) v ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}`;
    const [rows, count, permissions] = await Promise.all([
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM ${from} ORDER BY ${sort} LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`, ...sql.params),
      prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM ${from}`, ...sql.params),
      form16Permissions(subject),
    ]);
    return { rows: rows.map(plain), total: count[0]?.n ?? 0, page: query.page, limit: query.limit, permissions };
  },

  /** CI initForm: the dropdowns and the Form 16 the quarter is for (`id`: edit; `form16`: add from a Form 16). */
  async form(subject: RequestSubject, rawQuery: Record<string, string>): Promise<QuarterFormModel> {
    await requireForm16(subject, 'list');
    const editing = rawQuery.id ? await findQuarter(subject, parseId(rawQuery.id)) : null;
    const parentId = editing ? Number(editing.FORM16_ID) : Number(rawQuery.form16);
    const parent = Number.isInteger(parentId) && parentId > 0 ? await form16InScope(subject, parentId) : null;
    if (rawQuery.form16 && !editing && !parent) throw new NotFoundError('Record not found.');
    const [quarters, oltas, form16s, canSave] = await Promise.all([
      quarterOptions(),
      oltasOptions(),
      parent ? Promise.resolve([]) : form16Options(subject),
      requireForm16(subject, editing ? 'update' : 'create').then(() => true, () => false),
    ]);
    const missingMasters = [...(quarters.length ? [] : ['Quarters (master type SYSQUA)']), ...(oltas.length ? [] : ['OLTAS Status (master type SYSOLT)'])];
    return {
      options: {
        quarters: (await keepCurrent(quarters, editing?.QUARTERS_ID, masterLabel)) as IdLabel[],
        oltas: (await keepCurrent(oltas, Number(str(editing?.OLTAS_STATUS)), masterLabel)) as IdLabel[],
        form16s,
      },
      form16: parent ? { id: parent.id, label: parent.label } : null,
      canSave,
      missingMasters,
    };
  },

  async get(subject: RequestSubject, rawId: string): Promise<QuarterValues> {
    await requireForm16(subject, 'list');
    return toValues(await findQuarter(subject, parseId(rawId)));
  },

  /** CI insert($form16_id). */
  async create(subject: RequestSubject, body: unknown): Promise<{ id: number; form16Id: number; message: string }> {
    await requireForm16(subject, 'create');
    const v = parseBody(body);
    const parent = await requireParent(subject, v.FORM16_ID);
    await validate(v, parent.id, null, null);
    await assertInsertSafe('form16_quarters', 'FORM16_QUARTERS_ID');
    const [owner] = await prisma.$queryRaw<Array<{ oa: number; brand: number; user: number }>>`
      SELECT "OA_ID" AS oa, "OA_BRAND_ID" AS brand, "USER_ID" AS "user" FROM form16 WHERE "FORM16_ID" = ${parent.id}`;
    const [row] = await prisma.$queryRaw<Array<{ id: number }>>`
      INSERT INTO form16_quarters ("FORM16_ID", "QUARTERS_ID", "RECEIPT_NO", "AMOUNT", "AMOUNT_TAX", "PERIOD_ID", "BSR_CODE", "TAX_DATE",
        "CHALLAN_SL_NO", "OLTAS_STATUS", "OA_ID", "OA_BRAND_ID", "USER_ID", "CREATED_BY", "UPDATED_BY", "CREATED_ON", "UPDATED_ON", "IS_DELETED")
      VALUES (${parent.id}, ${Number(v.QUARTERS_ID)}, ${v.RECEIPT_NO}, ${Number(v.AMOUNT)}, ${Number(v.AMOUNT_TAX)}, 0, ${v.BSR_CODE}, ${v.TAX_DATE}::date,
        ${v.CHALLAN_SL_NO}, ${v.OLTAS_STATUS}, ${Number(owner?.oa ?? parent.oaId ?? 0)}, ${Number(owner?.brand ?? parent.brand)}, ${Number(owner?.user ?? subject.userId)},
        ${String(subject.userId)}, ${String(subject.userId)}, now(), now(), 0)
      RETURNING "FORM16_QUARTERS_ID" AS id`;
    return { id: Number(row.id), form16Id: parent.id, message: 'Successfully Added Form-16 Quarters' };
  },

  /** CI update($id, $form16_id): the quarter stays with its Form 16. */
  async update(subject: RequestSubject, rawId: string, body: unknown): Promise<{ id: number; form16Id: number; message: string }> {
    await requireForm16(subject, 'update');
    const id = parseId(rawId);
    const row = await findQuarter(subject, id);
    const existing = toValues(row);
    const v = { ...parseBody(body), FORM16_ID: existing.FORM16_ID };
    const form16Id = Number(existing.FORM16_ID);
    await validate(v, form16Id, id, existing);
    await prisma.$executeRaw`
      UPDATE form16_quarters SET "QUARTERS_ID" = ${Number(v.QUARTERS_ID)}, "RECEIPT_NO" = ${v.RECEIPT_NO}, "AMOUNT" = ${Number(v.AMOUNT)},
        "AMOUNT_TAX" = ${Number(v.AMOUNT_TAX)}, "BSR_CODE" = ${v.BSR_CODE}, "TAX_DATE" = ${v.TAX_DATE}::date, "CHALLAN_SL_NO" = ${v.CHALLAN_SL_NO},
        "OLTAS_STATUS" = ${v.OLTAS_STATUS}, "UPDATED_BY" = ${String(subject.userId)}, "UPDATED_ON" = now()
      WHERE "FORM16_QUARTERS_ID" = ${id}`;
    return { id, form16Id, message: 'Successfully Updated Form-16 Quarters' };
  },

  /** CI delete($id) — soft here. */
  async remove(subject: RequestSubject, rawId: string): Promise<{ id: number; message: string }> {
    await requireForm16(subject, 'delete');
    const id = parseId(rawId);
    await findQuarter(subject, id);
    await prisma.$executeRaw`
      UPDATE form16_quarters SET "IS_DELETED" = 1, "UPDATED_BY" = ${String(subject.userId)}, "UPDATED_ON" = now() WHERE "FORM16_QUARTERS_ID" = ${id}`;
    return { id, message: 'Successfully Deleted Form-16 Quarters' };
  },
};

/** The live quarters of a Form 16 for the PDF (CI getQuarters / getBsrCodedata), in table order. */
export async function quartersOfForm16(form16Id: number): Promise<Array<Record<string, unknown>>> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM (SELECT ${LIST_COLUMNS} FROM ${FROM} WHERE q."IS_DELETED" = 0 AND q."FORM16_ID" = $1::int) v ORDER BY ${QUARTER_ORDER}`,
    form16Id,
  );
  return rows.map(plain);
}

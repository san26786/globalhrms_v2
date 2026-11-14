import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { prisma } from '@/lib/prisma';
import {
  countryOptions,
  employeeForm16Details,
  periodOptions,
} from '@/lib/payroll/form16/shared';
import { form16Defs } from '../defs/form16';
import { asId, columnsOf, masterName, str, type HubConfig, type HubContext, type Tx } from '../hubEngine';
import { keepCurrent, masterLabel, periodLabel } from '../hubOptions';
import type { HubValues } from '../hubTypes';

/**
 * CI form16/form16 ("Form 16", menu 759): an employee's Form 16 — address, salary, the deductor's PAN / TAN — with its
 * quarters (form16_quarters, lib/payroll/form16/quarters.ts) and the certificate PDF (lib/payroll/form16/document.ts).
 * List scoping, the employee picker (a normal user: themself) and the menu grant follow the Employee Hub engine, as
 * CI getTableDtl / getAllEmployeeMst did.
 *
 * Period / Financial Period: CI's update() wrote form16.PERIOD_ID / FINANCIAL_PERIOD_ID, but the migrated table has
 * neither column (and form16_vw's Form Settings have no such attributes, so CI's live form hid both selects). They are
 * stored when the columns exist (read and written by name) and otherwise only travel with the PDF request, as CI's
 * Form16PdfData took the financial year from the posted form.
 *
 * Behaviour changes: the employee stays fixed on edit (Employee Hub rule); USER_ID is the employee's login user (CI:
 * whoever saved it, so a normal user listed the Form 16s they had typed rather than their own); OA_ID / OA_BRAND_ID
 * are the employee's (CI: the session's); the Postal Code must be digits (the column is an integer — CI's MySQL stored
 * 0 for anything else); CREATED_ON / UPDATED_ON (integer columns) hold Unix seconds (CI's MySQL truncated its
 * date string to the year); delete is soft and takes the Form 16's quarters with it (CI hard-deleted the Form 16 and
 * left its quarters); the deductor's PAN / TAN default to the brand's Form-16 Settings on add (CI's settings were
 * never read).
 */
const FORM_COLUMNS: Array<[field: string, column: string]> = [
  ['ADDRESS1', 'ADDRESS1'],
  ['ADDRESS2', 'ADDRESS2'],
  ['ADDRESS3', 'ADDRESS3'],
  ['CITY', 'CITY'],
  ['COUNTRY', 'COUNTRY'],
  ['APPLICABLE_TAX', 'APPLICABLE_TAX'],
  ['PAN', 'PAN'],
  ['TAN', 'TAN'],
];
/** Columns CI wrote that the migrated table may not have. */
const PERIOD_COLUMNS: Array<[field: string, column: string]> = [
  ['PERIOD_ID', 'PERIOD_ID'],
  ['FINANCIAL_PERIOD_ID', 'FINANCIAL_PERIOD_ID'],
];

const EPOCH = `extract(epoch from now())::int`;
const text = (v: string | boolean | undefined) => (typeof v === 'string' ? v.trim() : '');
const whole = (v: string | boolean | undefined) => {
  const n = Number(text(v));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/** The period columns the table really has (PERIOD_ID / FINANCIAL_PERIOD_ID). */
async function periodColumns(): Promise<Array<[string, string]>> {
  const cols = await columnsOf('form16');
  return PERIOD_COLUMNS.flatMap(([field, column]) => {
    const meta = cols.get(column);
    return meta ? [[field, meta.name] as [string, string]] : [];
  });
}

/** Column → typed SQL value for the record (both inserts and updates). */
async function recordValues(v: HubValues, ctx: HubContext, params: unknown[]): Promise<Array<{ column: string; value: string }>> {
  const p = (value: unknown, cast: string) => {
    params.push(value);
    return `$${params.length}::${cast}`;
  };
  const out = FORM_COLUMNS.map(([field, column]) => ({ column: `"${column}"`, value: p(text(v[field]), 'varchar') }));
  out.push({ column: '"POSTAL_CODE"', value: p(whole(v.POSTAL_CODE), 'int') });
  out.push({ column: '"SALARY"', value: p(whole(v.SALARY), 'int') });
  for (const [field, column] of await periodColumns()) {
    const id = Number(text(v[field]));
    out.push({ column: `"${column}"`, value: p(Number.isInteger(id) && id > 0 ? id : 0, 'int') });
  }
  const { employee, subject } = ctx;
  out.push(
    { column: '"EMP_ID"', value: p(employee.id, 'int') },
    { column: '"OA_ID"', value: p(employee.oaId ?? 0, 'int') },
    { column: '"OA_BRAND_ID"', value: p(employee.brand, 'int') },
    { column: '"USER_ID"', value: p(employee.userId ?? subject.userId, 'int') },
  );
  return out;
}

async function insertForm16(tx: Tx, v: HubValues, ctx: HubContext): Promise<number> {
  await assertInsertSafe('form16', 'FORM16_ID');
  const params: unknown[] = [];
  const pairs = await recordValues(v, ctx, params);
  params.push(String(ctx.subject.userId));
  const by = `$${params.length}::varchar`;
  pairs.push(
    { column: '"CREATED_BY"', value: by },
    { column: '"CREATED_ON"', value: EPOCH },
    { column: '"UPDATED_BY"', value: by },
    { column: '"UPDATED_ON"', value: EPOCH },
    { column: '"IS_DELETED"', value: '0' },
  );
  const [row] = await tx.$queryRawUnsafe<Array<{ id: number }>>(
    `INSERT INTO form16 (${pairs.map((x) => x.column).join(', ')}) VALUES (${pairs.map((x) => x.value).join(', ')}) RETURNING "FORM16_ID" AS id`,
    ...params,
  );
  return Number(row.id);
}

async function updateForm16(tx: Tx, v: HubValues, ctx: HubContext): Promise<void> {
  const params: unknown[] = [];
  const pairs = await recordValues(v, ctx, params);
  params.push(String(ctx.subject.userId));
  pairs.push({ column: '"UPDATED_BY"', value: `$${params.length}::varchar` }, { column: '"UPDATED_ON"', value: EPOCH });
  params.push(ctx.id);
  await tx.$executeRawUnsafe(
    `UPDATE form16 SET ${pairs.map((x) => `${x.column} = ${x.value}`).join(', ')} WHERE "FORM16_ID" = $${params.length}::int`,
    ...params,
  );
}

/** Soft delete of the Form 16 and its quarters. */
export async function removeForm16(tx: Tx, id: number, actorId: number): Promise<void> {
  await tx.$executeRawUnsafe(
    `UPDATE form16 SET "IS_DELETED" = 1, "UPDATED_BY" = $2::varchar, "UPDATED_ON" = ${EPOCH} WHERE "FORM16_ID" = $1::int`,
    id, String(actorId),
  );
  await tx.$executeRawUnsafe(
    `UPDATE form16_quarters SET "IS_DELETED" = 1, "UPDATED_BY" = $2::varchar, "UPDATED_ON" = now() WHERE "FORM16_ID" = $1::int AND "IS_DELETED" = 0`,
    id, String(actorId),
  );
}

/** A period column of t when the table has it (NULL otherwise) — read through the row's JSON so the SQL works either way. */
const optionalColumn = (column: string) => `(to_jsonb(t) ->> '${column}')`;
const periodName = (column: string) =>
  `(SELECT btrim(regexp_replace(p."FISCAL_PERIOD_DESC", '\\s+', ' ', 'g')) FROM period_mst p WHERE p."PERIOD_ID" = ${asId(optionalColumn(column))} LIMIT 1)`;

/** The brand's Form-16 Settings PAN / TAN (the deductor's), for a new Form 16. */
async function settingsDefaults(brand: number | null): Promise<HubValues> {
  if (!brand) return {};
  const [row] = await prisma.$queryRaw<Array<{ pan: string | null; tan: string | null }>>`
    SELECT "PAN" AS pan, "TAN" AS tan FROM form16_settings WHERE "OA_BRAND_ID" = ${brand} AND "IS_DELETED" = 0 ORDER BY "FORM16_SETTINGS_ID" LIMIT 1`;
  return row ? { PAN: str(row.pan), TAN: str(row.tan) } : {};
}

export const form16Config: HubConfig = {
  key: 'form16',
  defs: form16Defs,
  table: 'form16',
  pk: 'FORM16_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: `t."FORM16_ID", t."EMP_ID", ${periodName('PERIOD_ID')} AS "PERIOD_NM", ${periodName('FINANCIAL_PERIOD_ID')} AS "FINANCIAL_PERIOD_NM",
    t."ADDRESS1", t."ADDRESS2", t."ADDRESS3", t."POSTAL_CODE", t."CITY", t."COUNTRY", ${masterName('t."COUNTRY"')} AS "COUNTRY_NM",
    t."SALARY", t."APPLICABLE_TAX", t."PAN", t."TAN", t."OA_ID", t."USER_ID"`,
  search: ['PERIOD_NM', 'FINANCIAL_PERIOD_NM', 'ADDRESS1', 'ADDRESS2', 'ADDRESS3', 'POSTAL_CODE', 'CITY', 'COUNTRY_NM', 'SALARY', 'APPLICABLE_TAX', 'PAN', 'TAN'],
  sorts: ['FORM16_ID', 'EMP_ID', 'PERIOD_NM', 'FINANCIAL_PERIOD_NM', 'ADDRESS1', 'ADDRESS2', 'ADDRESS3', 'POSTAL_CODE', 'CITY', 'COUNTRY_NM', 'SALARY', 'APPLICABLE_TAX', 'PAN', 'TAN'],
  bind: {
    PERIOD_ID: 'PERIOD_ID',
    FINANCIAL_PERIOD_ID: 'FINANCIAL_PERIOD_ID',
    ADDRESS1: 'ADDRESS1',
    ADDRESS2: 'ADDRESS2',
    ADDRESS3: 'ADDRESS3',
    POSTAL_CODE: 'POSTAL_CODE',
    CITY: 'CITY',
    COUNTRY: 'COUNTRY',
    SALARY: 'SALARY',
    APPLICABLE_TAX: 'APPLICABLE_TAX',
    PAN: 'PAN',
    TAN: 'TAN',
  },
  deleteMode: 'soft',
  messages: { created: 'Successfully Added Form-16 Details', updated: 'Successfully Updated Form-16 Details', deleted: 'Successfully Deleted' },

  async options(_subject, brand, row) {
    const [countries, assessmentYears, financialYears] = await Promise.all([countryOptions(), periodOptions('OPTAY', brand), periodOptions('OPTFY', brand)]);
    return {
      countries: await keepCurrent(countries, asNumber(row?.COUNTRY), masterLabel),
      assessmentYears: await keepCurrent(assessmentYears, row?.PERIOD_ID, periodLabel),
      financialYears: await keepCurrent(financialYears, row?.FINANCIAL_PERIOD_ID, periodLabel),
    };
  },

  defaults: async (_subject, brand) => settingsDefaults(brand),

  /** CI form16.js: the picked employee's salary and address (extras.employee[EMP_ID]). */
  async employeeOptions(employee) {
    const details = await employeeForm16Details(employee.id);
    return { options: {}, extras: { employee: { [String(employee.id)]: { ...details } } } };
  },

  read(_row, values) {
    // CI's MySQL stored 0 for "no value" in the integer columns.
    if (values.POSTAL_CODE === '0') values.POSTAL_CODE = '';
    if (values.COUNTRY === '0') values.COUNTRY = '';
  },

  validate(v, check, ctx) {
    const postal = text(v.POSTAL_CODE).replace(/\s+/g, '');
    v.POSTAL_CODE = postal;
    if (postal && !check.has('POSTAL_CODE') && !/^\d{1,9}$/.test(postal)) {
      check.fail('POSTAL_CODE', 'The Postal Code field must contain only digits (at most 9).');
    }
    const salary = text(v.SALARY);
    if (salary && !check.has('SALARY') && (!ctx.existing || salary !== ctx.existing.SALARY) && Number(salary) > 2147483647) {
      check.fail('SALARY', 'The Salary field is too large.');
    }
  },

  insert: insertForm16,
  update: updateForm16,
  remove: (tx, ctx) => removeForm16(tx, ctx.id!, ctx.subject.userId),
};

function asNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

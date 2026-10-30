import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { NotFoundError, ValidationError } from '@/lib/http/errors';
import { getMasterId, getMasterOptionsByTypeCode } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { parseListQuery } from '@/lib/resource/listQuery';
import type { ListResult, ResourcePermissions } from '@/lib/resource/types';
import { activeBrand, authorize, brandOrgId, mastersOfTypeCode, requireBrandAdmin, type IdLabel } from '@/lib/systmMngt/shared';
import {
  CONDITIONAL_MONTHLY,
  MONTHS,
  RULE_TYPES,
  SECTION_FIELDS,
  isRuleTypeCode,
  ruleFieldsFor,
  ruleMenuUrl,
  type RuleFormModel,
  type RuleRow,
  type RuleTypeCode,
  type RuleValues,
  type SectionField,
} from './ruleTypes';

/**
 * CI benefitrules/benefitrules (Advance Settings → "Benefit Rules", "Investment Declaration Rules",
 * "Flat Deduction Rules", "Rebate Rules"): pay_component_benefit_rules rows of one rule type
 * (RULE_TYPE_ID = the type's master id) — list, add, edit, delete, and "Sync Module", which copies the
 * system template rules (OA_BRAND_ID 0) into the active brand. Payroll generation
 * (lib/systmMngt/employeePayments) reads these rules.
 *
 * Scoping as CI getTableDtl (orgColumn BRAND_ID, userColumn USERID): sysadmin every row, brand admin
 * the brand's rows, a user their own rows — for edit and delete as well.
 *
 * Storage follows the existing rows: 0 for "no component / month / sign factor / country", '' for no
 * dependent component, and an open upper limit is OPEN_LIMIT 1 with UPPER_LIMIT '&infin;'.
 *
 * Behaviour changes: the list and form need no MySQL views (pay_component_benefit_rules_vw & co. were
 * not migrated); the record's own rule type decides the form (CI trusted the URL and could rewrite the
 * type); edit / delete are scoped (CI wrote by id alone) and keep the record's owner (CI re-stamped it
 * on every save); delete is a soft delete and returns to the same list (CI hard-deleted and always went
 * to Benefit Rules); fields a type / section does not use are cleared instead of keeping stale hidden
 * values; limits must be numbers; Severe Type / Disability Type are stored the right way round (CI's
 * insert swapped them); Sync is for brand admins, copies every rule column and skips rules the brand
 * already has (CI duplicated everything on each click and dropped month, payment, age, …).
 */

const TABLE = 'pay_component_benefit_rules';
const OPEN = '&infin;';

type Scope = { sql: string; params: unknown[] };

function typeOf(code: string): RuleTypeCode {
  if (!isRuleTypeCode(code)) throw new NotFoundError('Rule type not found.');
  return code;
}

async function typeId(code: RuleTypeCode): Promise<number> {
  const id = await getMasterId(code);
  if (!id) throw new NotFoundError('Rule type not found.');
  return id;
}

/** CI getTableDtl scoping as a WHERE fragment; `$n` placeholders start after `offset`. */
function scopeOf(subject: RequestSubject, offset: number): Scope {
  if (subject.adminLevel === 2) return { sql: 'TRUE', params: [] };
  if (subject.adminLevel === 0) return { sql: `r."USER_ID" = $${offset + 1}`, params: [subject.userId] };
  return { sql: `r."OA_BRAND_ID" = $${offset + 1}`, params: [subject.oaBrandId ?? -1] };
}

async function permissionsOf(subject: RequestSubject, code: RuleTypeCode): Promise<ResourcePermissions> {
  const policy = menuPolicy(ruleMenuUrl(code));
  const [create, update, del] = await Promise.all([policy.check(subject, 'create'), policy.check(subject, 'update'), policy.check(subject, 'delete')]);
  return { create, update, delete: del };
}

/** Name of a master id held in an int or a text column (independent_mst has duplicated rows). */
const masterName = (column: string, text = false) =>
  `(SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID"${text ? '::text' : ''} = r."${column}" ORDER BY im."MSTR_ID" LIMIT 1)`;

const ROW_SELECT = `
  r."BENEFIT_RULES_ID" AS id,
  (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = r."RULE_TYPE_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS "ruleTypeCode",
  ${masterName('COMPONENT_ID')} AS component,
  ${masterName('SECTION_ID')} AS section,
  ${masterName('CALCULATION_FACTOR')} AS "calculationFactor",
  ${masterName('DEPENDENT_ON_COMP', true)} AS "dependentOn",
  ${masterName('TAX_ALLOWANCE_TYPE_ID')} AS "taxAllowanceType",
  r."LOWER_LIMIT"::text AS "lowerLimit",
  CASE WHEN r."OPEN_LIMIT" = 1 THEN '∞' ELSE r."UPPER_LIMIT" END AS "upperLimit",
  r."VALUES" AS values,
  ${masterName('SIGN_FACTOR')} AS "signFactor",
  CASE WHEN r."OPEN_LIMIT" = 1 THEN 'Yes' ELSE 'No' END AS "openLimit",
  ${masterName('GENDER')} AS gender,
  r."MONTH" AS month_no,
  ${masterName('AGE', true)} AS age,
  ${masterName('EXPENSES_TYPE', true)} AS "expensesType",
  ${masterName('SEVERE_TYPE', true)} AS "severeType",
  ${masterName('DISABILITY_TYPE', true)} AS "disabilityType",
  ${masterName('PAYMENT', true)} AS payment,
  (SELECT p."FISCAL_PERIOD_DESC" FROM period_mst p WHERE p."PERIOD_ID" = r."FINANCIAL_YEAR_ID" LIMIT 1) AS "financialYear",
  ${masterName('COUNTRY')} AS country,
  r."COMMENT" AS comment,
  (SELECT b."OA_BRAND_NM" FROM oa_brands b WHERE b."OA_BRAND_ID" = r."OA_BRAND_ID" LIMIT 1) AS brand`;

type RawRow = Omit<RuleRow, 'month'> & { month_no: number | null };

const toRow = ({ month_no, ...r }: RawRow): RuleRow => ({
  ...r,
  id: Number(r.id),
  ruleTypeCode: isRuleTypeCode(r.ruleTypeCode) ? r.ruleTypeCode : null,
  month: month_no && month_no >= 1 && month_no <= 12 ? MONTHS[month_no - 1] : null,
});

const SORTS: Record<string, string> = {
  id: 'r."BENEFIT_RULES_ID"',
  lowerLimit: 'r."LOWER_LIMIT"',
  values: 'r."VALUES"',
  component: '3',
  section: '4',
};

async function findScoped(subject: RequestSubject, id: number) {
  const scope = scopeOf(subject, 1);
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT r.*, to_char(r."LOWER_LIMIT", 'FM999999990.00') AS lower_text,
            (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = r."RULE_TYPE_ID" ORDER BY im."MSTR_ID" LIMIT 1) AS type_code
     FROM ${TABLE} r WHERE r."BENEFIT_RULES_ID" = $1 AND r."IS_DELETED" = 0 AND ${scope.sql}`,
    id,
    ...scope.params,
  );
  const row = rows[0];
  if (!row || !isRuleTypeCode(row.type_code as string)) throw new NotFoundError('Rule not found.');
  return { row, code: row.type_code as RuleTypeCode };
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('Rule not found.');
  return id;
}

/** CI getAllNotClosedPeriodDetails(OPTFY): the brand's financial years (duplicated descriptions once). */
async function financialYears(brand: number, keep: number | null): Promise<IdLabel[]> {
  const fy = await getMasterId('OPTFY');
  if (!fy) return [];
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string | null }>>`
    SELECT value, label FROM (
      SELECT DISTINCT ON (p."FISCAL_PERIOD_DESC") p."PERIOD_ID" AS value, p."FISCAL_PERIOD_DESC" AS label
      FROM period_mst p
      WHERE p."PERIOD_TYPE_ID" = ${fy} AND p."OA_BRAND_ID" = ${brand}
      ORDER BY p."FISCAL_PERIOD_DESC", p."PERIOD_ID"
    ) fy
    UNION
    SELECT p."PERIOD_ID", p."FISCAL_PERIOD_DESC" FROM period_mst p WHERE p."PERIOD_ID" = ${keep ?? -1}
    ORDER BY 2 DESC, 1`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label ?? String(r.value) }));
}

async function formOptions(brand: number, keepYear: number | null) {
  const coded = (typeCode: string) =>
    getMasterOptionsByTypeCode(typeCode).then((list) => list.map((o) => ({ value: o.value, label: o.label, code: o.code })));
  const [sections, taxAllowanceTypes, components, calculationFactors, completionStatuses, payments, ages, medicalExpenses,
    dependentDisabilities, disabilityTypes, signFactors, genders, years, countries] = await Promise.all([
    coded('EMPIAP'),
    mastersOfTypeCode('TAXALWTYP'),
    mastersOfTypeCode('PSC'),
    coded('CF'),
    mastersOfTypeCode('COMST'),
    mastersOfTypeCode('PAY'),
    mastersOfTypeCode('AGE'),
    mastersOfTypeCode('MED'),
    mastersOfTypeCode('TPE'),
    mastersOfTypeCode('DISTPE'),
    mastersOfTypeCode('SF'),
    mastersOfTypeCode('GNDR'),
    financialYears(brand, keepYear),
    mastersOfTypeCode('HTGHN'),
  ]);
  return {
    sections, taxAllowanceTypes, components, calculationFactors, completionStatuses, payments, ages, medicalExpenses,
    dependentDisabilities, disabilityTypes, signFactors, genders, financialYears: years, countries,
  };
}

// ------------------------------------------------------------------ validation

const str = z.preprocess((v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v)), z.string().max(250));
const flag = z.preprocess((v) => v === true || v === 1 || v === '1', z.boolean());
const bodySchema = z.object({
  tax_allowance_type: str, component_id: str, section_id: str, calculation_factor: str, month: str,
  dependent_on_component: str, self_occupied: flag, in_same_council: flag, completion_status: str, payment: str,
  age_id: str, medical_expenses: str, dependent_disability: str, disability_type: str, lower_limit: str,
  open_limit: flag, is_disable: flag, new_regime: flag, upper_limit: str, values: str, sign_factor: str,
  gender: str, comment: str, financial_year: str, country: str,
});
type Body = z.infer<typeof bodySchema>;
type Options = Awaited<ReturnType<typeof formOptions>>;

const NUMBER = /^-?\d{1,8}(\.\d{1,2})?$/;

/** CI setFormValidationRules + option membership + numeric limits; returns the columns to write. */
function toColumns(code: RuleTypeCode, body: unknown, options: Options) {
  const v: Body = bodySchema.parse(body);
  const uses = ruleFieldsFor(code);
  const errors: Record<string, string[]> = {};
  const fail = (field: keyof RuleValues, message: string) => (errors[field] ??= [message]);
  const pick = (field: keyof Body, label: string, list: Array<{ value: number }>, required = false): number | null => {
    const raw = v[field] as string;
    if (!raw) {
      if (required) fail(field, `The ${label} field is required.`);
      return null;
    }
    if (!list.some((o) => String(o.value) === raw)) {
      fail(field, `Select a valid ${label}.`);
      return null;
    }
    return Number(raw);
  };

  const calc = pick('calculation_factor', 'Calculation Factor', options.calculationFactors, true);
  const conditional = options.calculationFactors.find((o) => o.value === calc)?.code === CONDITIONAL_MONTHLY;
  const component = uses.component ? pick('component_id', 'Component', options.components, true) : null;
  const dependent = uses.component ? pick('dependent_on_component', 'Dependent On Component', options.components) : null;
  const taxAllowance = uses.component ? pick('tax_allowance_type', 'Tax Allowance Type', options.taxAllowanceTypes) : null;
  const section = uses.section ? pick('section_id', 'Section', options.sections, true) : null;
  const sectionCode = options.sections.find((o) => o.value === section)?.code ?? '';
  const sectionUses = new Set<SectionField>(uses.section ? (SECTION_FIELDS[sectionCode] ?? []) : []);
  const inSection = <T,>(field: SectionField, value: () => T): T | null => (sectionUses.has(field) ? value() : null);

  let month: number | null = null;
  if (conditional) {
    month = Number(v.month);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      fail('month', 'The Month field is required.');
      month = null;
    }
  }

  const limit = (field: 'lower_limit' | 'upper_limit', label: string, required: boolean) => {
    const raw = v[field];
    if (!raw) {
      if (required) fail(field, `The ${label} field is required.`);
      return null;
    }
    if (!NUMBER.test(raw)) fail(field, `The ${label} field must be a number with up to 2 decimals.`);
    return raw;
  };
  const lower = limit('lower_limit', 'Lower Limit', uses.limitsRequired);
  const upper = v.open_limit ? OPEN : limit('upper_limit', 'Upper Limit', uses.limitsRequired);
  if (lower && upper && upper !== OPEN && NUMBER.test(lower) && NUMBER.test(upper) && Number(upper) < Number(lower)) {
    fail('upper_limit', 'The Upper Limit must not be less than the Lower Limit.');
  }
  if (!v.values) fail('values', 'The Values field is required.');

  const columns = {
    TAX_ALLOWANCE_TYPE_ID: taxAllowance,
    COMPONENT_ID: component ?? 0,
    SECTION_ID: section,
    CALCULATION_FACTOR: calc ?? 0,
    MONTH: month ?? 0,
    DEPENDENT_ON_COMP: dependent === null ? '' : String(dependent),
    SELF_OCCUPIED: inSection('self_occupied', () => (v.self_occupied ? 1 : 0)) ?? 0,
    IN_SAME_COUNCIL: inSection('in_same_council', () => (v.in_same_council ? 1 : 0)) ?? 0,
    COMPLETION_STATUS_ID: inSection('completion_status', () => pick('completion_status', 'Completion Status', options.completionStatuses)),
    PAYMENT: inSection('payment', () => pick('payment', 'Payment', options.payments))?.toString() ?? null,
    AGE: inSection('age_id', () => pick('age_id', 'Age', options.ages))?.toString() ?? null,
    EXPENSES_TYPE: inSection('medical_expenses', () => pick('medical_expenses', 'Medical Expenses', options.medicalExpenses))?.toString() ?? null,
    SEVERE_TYPE: inSection('dependent_disability', () => pick('dependent_disability', 'Dependent Disability', options.dependentDisabilities))?.toString() ?? null,
    DISABILITY_TYPE: inSection('disability_type', () => pick('disability_type', 'Disability Type', options.disabilityTypes))?.toString() ?? null,
    LOWER_LIMIT: lower ?? '0',
    OPEN_LIMIT: v.open_limit ? 1 : 0,
    IS_DISABLE: v.is_disable ? 1 : 0,
    NEW_REGIME: v.new_regime,
    UPPER_LIMIT: upper ?? '',
    VALUES: v.values,
    SIGN_FACTOR: pick('sign_factor', 'Sign Factor', options.signFactors) ?? 0,
    GENDER: pick('gender', 'Gender', options.genders),
    COMMENT: v.comment === '' ? null : v.comment,
    FINANCIAL_YEAR_ID: pick('financial_year', 'Financial Year', options.financialYears),
    COUNTRY: pick('country', 'Country', options.countries) ?? 0,
  };
  if (Object.keys(errors).length) throw new ValidationError('Validation failed.', errors);
  return columns;
}

type Columns = ReturnType<typeof toColumns>;

const COLUMN_TYPES: Record<keyof Columns, string> = {
  TAX_ALLOWANCE_TYPE_ID: 'integer', COMPONENT_ID: 'integer', SECTION_ID: 'integer', CALCULATION_FACTOR: 'integer',
  MONTH: 'integer', DEPENDENT_ON_COMP: 'text', SELF_OCCUPIED: 'smallint', IN_SAME_COUNCIL: 'smallint',
  COMPLETION_STATUS_ID: 'integer', PAYMENT: 'text', AGE: 'text', EXPENSES_TYPE: 'text', SEVERE_TYPE: 'text',
  DISABILITY_TYPE: 'text', LOWER_LIMIT: 'numeric', OPEN_LIMIT: 'smallint', IS_DISABLE: 'smallint', NEW_REGIME: 'boolean',
  UPPER_LIMIT: 'text', VALUES: 'text', SIGN_FACTOR: 'integer', GENDER: 'integer', COMMENT: 'text',
  FINANCIAL_YEAR_ID: 'integer', COUNTRY: 'integer',
};

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

// ------------------------------------------------------------------ service

export const benefitRulesService = {
  /** CI index($ruleCd): the type's rules, scoped like getTableDtl, with names for the list. */
  async list(subject: RequestSubject, rawQuery: Record<string, string>): Promise<ListResult<RuleRow> & { permissions: ResourcePermissions }> {
    const code = typeOf(rawQuery.type ?? 'BRTYSBR');
    await authorize(subject, ruleMenuUrl(code), 'list');
    const query = parseListQuery(rawQuery);
    const type = await typeId(code);

    const params: unknown[] = [type];
    const scope = scopeOf(subject, params.length);
    params.push(...scope.params);
    let where = `r."RULE_TYPE_ID" = $1 AND r."IS_DELETED" = 0 AND ${scope.sql}`;
    if (query.search) {
      params.push(`%${query.search}%`);
      const p = `$${params.length}`;
      where += ` AND (r."VALUES" ILIKE ${p} OR r."COMMENT" ILIKE ${p} OR r."LOWER_LIMIT"::text ILIKE ${p}
        OR ${masterName('COMPONENT_ID')} ILIKE ${p} OR ${masterName('SECTION_ID')} ILIKE ${p} OR ${masterName('CALCULATION_FACTOR')} ILIKE ${p})`;
    }
    const sort = SORTS[query.sort ?? ''] ?? 'r."BENEFIT_RULES_ID"';
    const dir = query.sort && SORTS[query.sort] ? (query.dir === 'desc' ? 'DESC' : 'ASC') : 'DESC';

    const [rows, total, permissions] = await Promise.all([
      prisma.$queryRawUnsafe<RawRow[]>(
        `SELECT ${ROW_SELECT} FROM ${TABLE} r WHERE ${where}
         ORDER BY ${sort} ${dir} NULLS LAST, r."BENEFIT_RULES_ID" DESC
         LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
        ...params,
      ),
      prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM ${TABLE} r WHERE ${where}`, ...params),
      permissionsOf(subject, code),
    ]);
    return { rows: rows.map(toRow), total: total[0]?.n ?? 0, page: query.page, limit: query.limit, permissions };
  },

  /** CI initForm options for a type (add) — or for the record's own type (edit, with `id`). */
  async form(subject: RequestSubject, rawQuery: Record<string, string>): Promise<RuleFormModel> {
    let code: RuleTypeCode;
    let keepYear: number | null = null;
    if (rawQuery.id) {
      const found = await findScoped(subject, parseId(rawQuery.id));
      code = found.code;
      keepYear = (found.row.FINANCIAL_YEAR_ID as number | null) ?? null;
    } else {
      code = typeOf(rawQuery.type ?? '');
    }
    await authorize(subject, ruleMenuUrl(code), rawQuery.id ? 'read' : 'create');
    return { code, title: RULE_TYPES[code].title, options: await formOptions(activeBrand(subject), keepYear) };
  },

  async get(subject: RequestSubject, rawId: string): Promise<RuleValues & { code: RuleTypeCode }> {
    const { row: r, code } = await findScoped(subject, parseId(rawId));
    await authorize(subject, ruleMenuUrl(code), 'read');
    const zeroBlank = (v: unknown) => (Number(v) ? String(v) : '');
    return {
      code,
      tax_allowance_type: s(r.TAX_ALLOWANCE_TYPE_ID),
      component_id: zeroBlank(r.COMPONENT_ID),
      section_id: s(r.SECTION_ID),
      calculation_factor: zeroBlank(r.CALCULATION_FACTOR),
      month: zeroBlank(r.MONTH),
      dependent_on_component: s(r.DEPENDENT_ON_COMP),
      self_occupied: r.SELF_OCCUPIED === 1,
      in_same_council: r.IN_SAME_COUNCIL === 1,
      completion_status: s(r.COMPLETION_STATUS_ID),
      payment: s(r.PAYMENT),
      age_id: s(r.AGE),
      medical_expenses: s(r.EXPENSES_TYPE),
      dependent_disability: s(r.SEVERE_TYPE),
      disability_type: s(r.DISABILITY_TYPE),
      lower_limit: s(r.lower_text),
      open_limit: r.OPEN_LIMIT === 1,
      is_disable: r.IS_DISABLE === 1,
      new_regime: r.NEW_REGIME === true,
      upper_limit: r.OPEN_LIMIT === 1 ? '' : s(r.UPPER_LIMIT),
      values: s(r.VALUES),
      sign_factor: zeroBlank(r.SIGN_FACTOR),
      gender: s(r.GENDER),
      comment: s(r.COMMENT),
      financial_year: s(r.FINANCIAL_YEAR_ID),
      country: zeroBlank(r.COUNTRY),
    };
  },

  /** CI insert($ruleTypeId). Body: the form values + `type` (rule type code). */
  async create(subject: RequestSubject, body: unknown): Promise<{ id: number; message: string }> {
    const code = typeOf(String((body as { type?: unknown } | null)?.type ?? ''));
    await authorize(subject, ruleMenuUrl(code), 'create');
    const brand = activeBrand(subject);
    const columns = toColumns(code, body, await formOptions(brand, null));
    const data: Record<string, unknown> = { ...columns };
    const names = Object.keys(data);
    const values = names.map((n, i) => `$${i + 1}::${COLUMN_TYPES[n as keyof Columns]}`);
    const params: unknown[] = names.map((n) => data[n]);
    params.push(await typeId(code), await brandOrgId(brand, subject.oaId), brand, subject.userId);
    const p = params.length;

    await assertInsertSafe(TABLE, 'BENEFIT_RULES_ID');
    const [row] = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `INSERT INTO ${TABLE} (${names.map((n) => `"${n}"`).join(', ')}, "RULE_TYPE_ID", "OA_ID", "OA_BRAND_ID", "USER_ID",
         "IS_DELETED", "CREATED_BY", "CREATED_ON", "UPDATED_BY", "UPDATED_ON")
       VALUES (${values.join(', ')}, $${p - 3}::integer, $${p - 2}::integer, $${p - 1}::integer, $${p}::integer,
         0, $${p}::integer, now(), $${p}::integer, now())
       RETURNING "BENEFIT_RULES_ID" AS id`,
      ...params,
    );
    return { id: Number(row.id), message: `Successfully Added ${RULE_TYPES[code].title}` };
  },

  /** CI update($ruleTypeId): the record keeps its rule type, brand and owner. */
  async update(subject: RequestSubject, rawId: string, body: unknown): Promise<{ id: number; message: string }> {
    const id = parseId(rawId);
    const { row, code } = await findScoped(subject, id);
    await authorize(subject, ruleMenuUrl(code), 'update');
    const columns = toColumns(code, body, await formOptions(Number(row.OA_BRAND_ID) || activeBrand(subject), (row.FINANCIAL_YEAR_ID as number) ?? null));
    const names = Object.keys(columns) as Array<keyof Columns>;
    const sets = names.map((n, i) => `"${n}" = $${i + 1}::${COLUMN_TYPES[n]}`);
    const params: unknown[] = names.map((n) => columns[n]);
    params.push(subject.userId, id);
    await prisma.$executeRawUnsafe(
      `UPDATE ${TABLE} SET ${sets.join(', ')}, "UPDATED_BY" = $${params.length - 1}::integer, "UPDATED_ON" = now()
       WHERE "BENEFIT_RULES_ID" = $${params.length}::integer`,
      ...params,
    );
    return { id, message: `Successfully Updated ${RULE_TYPES[code].title}` };
  },

  /** CI delete($id) — soft delete, scoped. */
  async remove(subject: RequestSubject, rawId: string): Promise<{ id: number }> {
    const id = parseId(rawId);
    const { code } = await findScoped(subject, id);
    await authorize(subject, ruleMenuUrl(code), 'delete');
    await prisma.$executeRaw`
      UPDATE pay_component_benefit_rules SET "IS_DELETED" = 1, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
      WHERE "BENEFIT_RULES_ID" = ${id}`;
    return { id };
  },

  /**
   * CI sync_benefit_rules_settings → replicateBenefitRules: the system template rules (brand 0, every
   * type) are copied into the active brand for its current financial year; a template the brand
   * already has (same type, section, component, factor, dependency, limits, value and gender) is skipped.
   */
  async sync(subject: RequestSubject, rawType: string): Promise<{ message: string; copied: number }> {
    const code = typeOf(rawType);
    await authorize(subject, ruleMenuUrl(code), 'create');
    requireBrandAdmin(subject);
    const brand = activeBrand(subject);
    const oaId = await brandOrgId(brand, subject.oaId);
    const fy = await getMasterId('OPTFY');
    const [year] = fy
      ? await prisma.$queryRaw<Array<{ id: number }>>`
          SELECT "PERIOD_ID" AS id FROM period_mst
          WHERE "PERIOD_TYPE_ID" = ${fy} AND "OA_BRAND_ID" = ${brand} AND CURRENT_DATE BETWEEN "PERIOD_START_DATE" AND "PERIOD_END_DATE"
          ORDER BY "PERIOD_ID" LIMIT 1`
      : [];
    const yearId = year?.id ?? null;

    const copied = await prisma.$executeRaw`
      INSERT INTO pay_component_benefit_rules (
        "RULE_TYPE_ID", "RULE_TYPE_CD", "SECTION_ID", "SECTION_CD", "TAX_ALLOWANCE_TYPE_ID", "TAX_ALLOWANCE_TYPE_CD",
        "COMPONENT_ID", "COMPONENT_CD", "CALCULATION_FACTOR", "CALCULATION_FACTOR_CD", "DEPENDENT_ON_COMP", "DEPENDENT_ON_COMP_CD",
        "LOWER_LIMIT", "UPPER_LIMIT", "PAYMENT", "EXPENSES_TYPE", "AGE", "SEVERE_TYPE", "DISABILITY_TYPE", "VALUES",
        "SIGN_FACTOR", "SIGN_FACTOR_CD", "OPEN_LIMIT", "IS_DISABLE", "GENDER", "GENDER_CD", "COUNTRY", "MONTH", "COMMENT",
        "FINANCIAL_YEAR_ID", "SELF_OCCUPIED", "COMPLETION_STATUS_ID", "IN_SAME_COUNCIL", "NEW_REGIME",
        "OA_ID", "OA_BRAND_ID", "USER_ID", "IS_DELETED", "CREATED_BY", "CREATED_ON", "UPDATED_BY", "UPDATED_ON")
      SELECT
        t."RULE_TYPE_ID", t."RULE_TYPE_CD", t."SECTION_ID", t."SECTION_CD", t."TAX_ALLOWANCE_TYPE_ID", t."TAX_ALLOWANCE_TYPE_CD",
        t."COMPONENT_ID", t."COMPONENT_CD", t."CALCULATION_FACTOR", t."CALCULATION_FACTOR_CD", t."DEPENDENT_ON_COMP", t."DEPENDENT_ON_COMP_CD",
        t."LOWER_LIMIT", t."UPPER_LIMIT", t."PAYMENT", t."EXPENSES_TYPE", t."AGE", t."SEVERE_TYPE", t."DISABILITY_TYPE", t."VALUES",
        t."SIGN_FACTOR", t."SIGN_FACTOR_CD", t."OPEN_LIMIT", t."IS_DISABLE", t."GENDER", t."GENDER_CD", t."COUNTRY", t."MONTH", t."COMMENT",
        ${yearId}::integer, t."SELF_OCCUPIED", t."COMPLETION_STATUS_ID", t."IN_SAME_COUNCIL", t."NEW_REGIME",
        ${oaId}, ${brand}, ${subject.userId}, 0, ${subject.userId}, now(), ${subject.userId}, now()
      FROM pay_component_benefit_rules t
      WHERE t."OA_BRAND_ID" = 0 AND t."IS_DELETED" = 0
        AND NOT EXISTS (
          SELECT 1 FROM pay_component_benefit_rules b
          WHERE b."OA_BRAND_ID" = ${brand} AND b."IS_DELETED" = 0
            AND b."RULE_TYPE_ID" IS NOT DISTINCT FROM t."RULE_TYPE_ID" AND b."SECTION_ID" IS NOT DISTINCT FROM t."SECTION_ID"
            AND b."COMPONENT_ID" = t."COMPONENT_ID" AND b."CALCULATION_FACTOR" = t."CALCULATION_FACTOR"
            AND b."DEPENDENT_ON_COMP" = t."DEPENDENT_ON_COMP" AND b."LOWER_LIMIT" = t."LOWER_LIMIT"
            AND b."UPPER_LIMIT" = t."UPPER_LIMIT" AND b."VALUES" = t."VALUES" AND b."GENDER" IS NOT DISTINCT FROM t."GENDER")`;
    return { message: copied ? `Successfully synced ${copied} rule(s) from the system defaults.` : 'All system default rules are already present.', copied };
  },
};

import { fullName, type Tx } from '@/lib/employeeMngt/hub/hubEngine';
import { BusinessRuleError } from '@/lib/http/errors';
import { getMasterIds } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { settingService } from '@/lib/settings/settingService';
import { brandOrgId } from '@/lib/systmMngt/shared';
import { advanceSalaryPayrollInputs } from '../advanceSalary';
import { toCents } from '../annexure/ruleMath';
import { findFinancialYear, type FinancialYear } from '../financialYear';
import { incentiveTotal } from '../incentive';
import { breakupColumns } from '../salaryBreakup';
import type { TaxRule, TdsCodes, TdsMode } from '../tds/compute';
import { toRunRule, type CopiedLine, type LineType, type RunSetup } from './compute';

/**
 * The payroll run's reads (CI emp_sal_component_mst::generateSalaryDetails and its models): the brand's masters,
 * settings, components and rules, loaded once per run; then each employee's annexure, attendance, inputs and tax data.
 *
 * Behaviour changes: the brand's own country (CI: the session user's); deleted rules and settings are ignored; the
 * newest live current annexure, refused when there are two (CI's copy failed half-way); attendance and the payroll
 * summary ignore deleted rows and take the newest; the former-employee check applies to every employee (CI: a
 * single-employee run only) and uses the last separation not followed by a rejoin (CI took one that was); advances
 * and loan instalments of the month are summed (CI took the first row); the regime is the newest job row's (CI: the
 * oldest).
 */
const FREQUENCIES: Record<string, string> = { annually: 'PFYLY', daily: 'PFDLY', weekly: 'PFWLY' };
const REQUIRED = ['PRSTAX', 'PRSTPS', 'PFYLY', 'PFMLY', 'PFWLY', 'PFDLY', 'SFPLUS', 'SFMINUS', 'CFP', 'CFFAC', 'CFCONR', 'CFSLRT', 'CMPTA', 'CMPTD', 'CMPTC',
  'SCLOP', 'PCINCARR', 'PCLOADV', 'SADVSAL', 'SADVREP', 'SLOAINST', 'SCPTX', 'SCINTX', 'SCODA', 'MACINARR', 'ITCTTDS', 'PSDFTI'] as const;
type Code = (typeof REQUIRED)[number];

export interface TaxSetup {
  mode: TdsMode;
  codes: TdsCodes;
  fyEnd: string;
  /** Every live tax rule of the brand's FY (slabs, flat, rebate, relief, cess and the non-taxable components). */
  rules: Array<TaxRule & { taxAllowanceType: number | null; sign: number; country: number | null }>;
  /** Components flagged "Deduct from Taxable Income" (PSDFTI), in settings order. */
  nonTaxableComponents: number[];
  rt: { BRTYFDR: number | null; BRTYRBE: number | null; BRTYMRF: number | null };
  country: number | null;
}

export interface RunContext {
  brand: number;
  oa: number;
  month: number;
  year: number;
  fy: FinancialYear;
  frequency: number;
  masters: Record<Code, number>;
  setup: RunSetup;
  tax: TaxSetup | null;
  /** SSASITC was neither TDS nor set: no income tax is computed. */
  taxWarning: string | null;
}

export const monthText = (month: number, year: number) => `${String(month).padStart(2, '0')}/${year}`;
const daysIn = (month: number, year: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const typeOf = (id: number | null, m: Record<Code, number>): LineType => (id === m.CMPTD ? 'deduction' : id === m.CMPTC ? 'contribution' : 'addition');

/** Settings types and breakup columns only — what reverting a payslip needs. */
export async function loadDeltaSetup(brand: number) {
  const codes = await getMasterIds([...REQUIRED, 'PCCOMMS']);
  const missing = REQUIRED.filter((c) => !codes[c]);
  if (missing.length) throw new BusinessRuleError(`Payroll masters are missing: ${missing.join(', ')}.`);
  const m = codes as Record<Code, number> & { PCCOMMS: number | null };
  const settings = await prisma.$queryRaw<Array<{ component: number; type: number | null }>>`
    SELECT DISTINCT ON (s."COMPONENT_ID") s."COMPONENT_ID" AS component, s."COMPONENT_TYPE" AS type
    FROM salary_component_settings s WHERE s."OA_BRAND_ID" = ${brand} AND s."IS_DELETED" = 0 AND s."COMPONENT_ID" IS NOT NULL
    ORDER BY s."COMPONENT_ID", s."SC_ID"`;
  const types = new Map(settings.map((s) => [Number(s.component), typeOf(s.type === null ? null : Number(s.type), m)]));
  const codesForRun = {
    SFPLUS: m.SFPLUS, SFMINUS: m.SFMINUS, CFP: m.CFP, CFFAC: m.CFFAC, CFCONR: m.CFCONR, CFSLRT: m.CFSLRT, SCLOP: m.SCLOP, PCINCARR: m.PCINCARR,
    PCLOADV: m.PCLOADV, SADVSAL: m.SADVSAL, SADVREP: m.SADVREP, SLOAINST: m.SLOAINST, SCPTX: m.SCPTX, SCINTX: m.SCINTX, SCODA: m.SCODA, PCCOMMS: m.PCCOMMS,
  };
  return { masters: m, types, columns: await breakupColumns(), codes: codesForRun };
}

/** Everything the brand's payslips of a month need, loaded once per run. */
export async function loadRunContext(brand: number, month: number, year: number, opts: { tdsMode?: TdsMode } = {}): Promise<RunContext> {
  const base = await loadDeltaSetup(brand);
  const m = base.masters;
  const fy = await findFinancialYear(brand, month, year);
  if (!fy) throw new BusinessRuleError('Please Generate Financial Period');

  const [frequencyName, taxMethod, basis] = await Promise.all([
    settingService.getValue('SSAF', brand),
    settingService.getRawValue('SSASITC', brand),
    settingService.getValue('SSASCLBSS', brand),
  ]);
  // CI's hourly basis (pay = worked hours × CTC rate) is used by no brand; it is not ported.
  if ((basis ?? '').trim().toLowerCase() === 'hourly') throw new BusinessRuleError('The hourly salary calculation basis (SSASCLBSS) is not supported.');
  const frequency = m[(FREQUENCIES[(frequencyName ?? '').trim().toLowerCase()] ?? 'PFMLY') as Code];
  const [settings] = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM payslip_settings WHERE "OA_BRAND_ID" = ${brand} AND COALESCE("IS_DELETED", 0) = 0`;
  if (!settings?.n) throw new BusinessRuleError('Please Update Payslip Settings');
  const [b] = await prisma.$queryRaw<Array<{ country: number | null; oa: number | null }>>`
    SELECT country, "OA_ID" AS oa FROM oa_brands WHERE "OA_BRAND_ID" = ${brand}`;
  const country = b?.country === null || b?.country === undefined ? null : Number(b.country);

  // CI getComponentSettingSelectedAdditions([SCODA]) and getComponentSettingExceptAdditions.
  const comps = await prisma.$queryRaw<Array<{ component: number; type: number; annexure: number }>>`
    SELECT s."COMPONENT_ID" AS component, s."COMPONENT_TYPE" AS type, s."VISIBLE_IN_ANNEXURE" AS annexure
    FROM salary_component_settings s
    WHERE s."OA_BRAND_ID" = ${brand} AND s."IS_DELETED" = 0 AND s."IS_ENABLED" = 1 AND s."VISIBLE_IN_SALARY" = 1 AND s."COMPONENT_ID" IS NOT NULL
    ORDER BY s."COMPONENT_SEQUENCE" ASC NULLS LAST, s."SC_ID" ASC`;
  const oda = comps.some((c) => Number(c.component) === m.SCODA && Number(c.type) === m.CMPTA);
  const ruleComponents = comps
    .filter((c) => Number(c.type) !== m.CMPTA && Number(c.annexure) === 0)
    .map((c) => ({ component: Number(c.component), type: typeOf(Number(c.type), m) }));
  const components = [m.SCODA, ...ruleComponents.map((c) => c.component)];
  const rules = await prisma.$queryRaw<Array<Parameters<typeof toRunRule>[0]>>`
    SELECT r."BENEFIT_RULES_ID" AS id, r."COMPONENT_ID" AS component, r."CALCULATION_FACTOR" AS factor, r."DEPENDENT_ON_COMP" AS dependent,
      r."LOWER_LIMIT"::text AS lower, r."UPPER_LIMIT" AS upper, r."OPEN_LIMIT" AS open, r."VALUES" AS values, r."SIGN_FACTOR" AS sign,
      r."GENDER" AS gender, r."MONTH" AS month, r."IS_DISABLE" AS "isDisable"
    FROM pay_component_benefit_rules r
    WHERE r."OA_BRAND_ID" = ${brand} AND r."FINANCIAL_YEAR_ID" = ${fy.id} AND r."IS_DELETED" = 0
      AND (${country}::int IS NULL OR r."COUNTRY" = ${country}::int)
      AND r."SIGN_FACTOR" IN (${m.SFPLUS}, ${m.SFMINUS}) AND r."COMPONENT_ID" = ANY(${components}::int[])
    ORDER BY r."LOWER_LIMIT" ASC, r."MONTH" DESC, r."BENEFIT_RULES_ID" ASC`;

  let tax: TaxSetup | null = null;
  let taxWarning: string | null = null;
  if (taxMethod && Number(taxMethod) === m.ITCTTDS) tax = await loadTaxSetup(brand, fy, country, m, opts.tdsMode ?? 'fixed');
  else taxWarning = 'Income tax calculation method (SSASITC) is not set to Tax Deduction at Source: no income tax was deducted.';

  return {
    brand,
    oa: (b?.oa ? Number(b.oa) : null) ?? (await brandOrgId(brand, null)) ?? 0,
    month,
    year,
    fy,
    frequency,
    masters: m,
    setup: {
      codes: base.codes, month, year, days: daysIn(month, year), tds: tax !== null, oda, ruleComponents,
      rules: rules.map(toRunRule), columns: base.columns, types: base.types,
    },
    tax,
    taxWarning,
  };
}

/** The FY's tax rules and settings (also read by the investment declarations' tax summary and Tax Breakup). */
export async function loadTaxSetup(brand: number, fy: FinancialYear, country: number | null, m: Record<Code, number>, mode: TdsMode): Promise<TaxSetup> {
  const rt = (await getMasterIds(['BRTYFDR', 'BRTYRBE', 'BRTYMRF'])) as TaxSetup['rt'];
  const nonTaxable = await prisma.$queryRaw<Array<{ component: number }>>`
    SELECT s."COMPONENT_ID" AS component FROM salary_component_settings s
    WHERE s."OA_BRAND_ID" = ${brand} AND s."TAXABLE_STATUS" = ${m.PSDFTI} AND s."IS_ENABLED" = 1 AND s."IS_DELETED" = 0 AND s."COMPONENT_ID" IS NOT NULL
    ORDER BY s."COMPONENT_SEQUENCE" ASC NULLS LAST, s."SC_ID" ASC`;
  const nonTaxableComponents = [...new Set(nonTaxable.map((r) => Number(r.component)))];
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT r."BENEFIT_RULES_ID" AS id, r."RULE_TYPE_ID" AS "ruleType", r."COMPONENT_ID" AS component, r."CALCULATION_FACTOR" AS factor,
      r."DEPENDENT_ON_COMP" AS dependent, r."LOWER_LIMIT"::text AS lower, r."UPPER_LIMIT" AS upper, r."OPEN_LIMIT" AS open, r."VALUES" AS values,
      r."MONTH" AS month, r."GENDER" AS gender, r."NEW_REGIME" AS "newRegime", r."TAX_ALLOWANCE_TYPE_ID" AS "taxAllowanceType",
      r."SIGN_FACTOR" AS sign, r."COUNTRY" AS country
    FROM pay_component_benefit_rules r
    WHERE r."OA_BRAND_ID" = ${brand} AND r."FINANCIAL_YEAR_ID" = ${fy.id} AND r."IS_DELETED" = 0
      AND (r."COMPONENT_ID" = ${m.SCINTX} OR btrim(r."DEPENDENT_ON_COMP") = ${String(m.SCINTX)}
           OR r."RULE_TYPE_ID" = ANY(${[rt.BRTYFDR, rt.BRTYRBE, rt.BRTYMRF].filter((x): x is number => !!x)}::int[])
           OR r."COMPONENT_ID" = ANY(${nonTaxableComponents}::int[]))
    ORDER BY r."LOWER_LIMIT" ASC, r."MONTH" DESC, r."BENEFIT_RULES_ID" ASC`;
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    mode,
    codes: { CFP: m.CFP, CFFAC: m.CFFAC, CFCONR: m.CFCONR },
    fyEnd: fy.end,
    rules: rows.map((r) => ({
      id: Number(r.id), ruleType: n(r.ruleType), component: n(r.component), factor: Number(r.factor), dependent: String(r.dependent ?? '').trim(),
      lower: Number(r.lower), upper: String(r.upper ?? ''), open: Number(r.open) === 1, values: String(r.values ?? ''), month: Number(r.month ?? 0),
      gender: n(r.gender), newRegime: r.newRegime === null || r.newRegime === undefined ? null : Boolean(r.newRegime),
      taxAllowanceType: n(r.taxAllowanceType), sign: Number(r.sign), country: n(r.country),
    })),
    nonTaxableComponents,
    rt,
    country,
  };
}

// ------------------------------------------------------------------ per employee

export interface EmployeeRecord {
  id: number;
  name: string;
  code: string | null;
  user: number | null;
  oa: number | null;
  brand: number;
  gender: number | null;
  isDisabled: boolean;
  taxAllowanceType: number | null;
  /** Last separation not followed by a rejoin (YYYY-MM-DD). */
  left: string | null;
}

export async function employeeRecord(db: Tx, id: number): Promise<EmployeeRecord | null> {
  const [e] = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT em."EMP_ID" AS id, ${fullName('em')} AS name, em."EMP_NBR" AS code, em."REF_EMP_ID" AS "user", em."OA_ID" AS oa, em."OA_BRAND_ID" AS brand,
       em."GENDER_ID" AS gender, em."IS_DISABLE" AS disabled, em."TAX_ALLOWANCE_TYPE_ID" AS tat,
       (SELECT to_char(t."TERMINATION_DATE", 'YYYY-MM-DD') FROM emp_termination_dtl t
        WHERE t."EMP_ID" = em."EMP_ID" AND t."IS_DELETED" = 0 AND t."TERMINATION_DATE" IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM emp_termination_dtl r WHERE r."EMP_ID" = t."EMP_ID" AND r."IS_DELETED" = 0 AND r."REJOIN_DATE" > t."TERMINATION_DATE")
        ORDER BY t."TERMINATION_DATE" DESC LIMIT 1) AS "left"
     FROM emp_mst em WHERE em."EMP_ID" = $1::int AND em."IS_DELETED" = 0`,
    id,
  );
  if (!e) return null;
  const n = (v: unknown) => (v === null || v === undefined || Number(v) === 0 ? null : Number(v));
  return {
    id: Number(e.id), name: String(e.name ?? ''), code: e.code ? String(e.code) : null, user: n(e.user), oa: n(e.oa), brand: Number(e.brand),
    gender: n(e.gender), isDisabled: Number(e.disabled ?? 0) === 1, taxAllowanceType: n(e.tat), left: e.left ? String(e.left) : null,
  };
}

/** CI checkAnnexureExists: the current annexure of the brand's frequency (its header and live rows). */
export async function currentAnnexures(db: Tx, ctx: RunContext, emp: number) {
  const headers = await db.$queryRaw<Array<{ id: number; actual: string | null; earned: string | null }>>`
    SELECT "EMP_SAL_ID" AS id, "ACTUAL_AMOUNT"::text AS actual, "EARNED_AMOUNT"::text AS earned FROM emp_basic_sal_mst
    WHERE "EMP_ID" = ${emp} AND "PAY_FREQUENCY_ID" = ${ctx.frequency} AND "IS_CURRENT" = 1 AND "IS_DELETED" = 0 AND "SAL_TYPE" = ${ctx.masters.PRSTAX}
    ORDER BY "EMP_SAL_ID" DESC LIMIT 2`;
  return headers.map((h) => ({ id: Number(h.id), actualCents: toCents(h.actual), earnedCents: toCents(h.earned) }));
}

export async function annexureLines(db: Tx, annexure: number): Promise<CopiedLine[]> {
  const rows = await db.$queryRaw<Array<{ component: number; amount: string | null }>>`
    SELECT "SAL_COMP_ID" AS component, "EARNED_AMOUNT"::text AS amount FROM emp_basic_sal_dtl
    WHERE "SAL_MST_ID" = ${annexure} AND "IS_DELETED" = 0 AND "SAL_COMP_ID" IS NOT NULL ORDER BY "EMP_BASIC_SAL_DTL_ID"`;
  return rows.map((r) => ({ component: Number(r.component), cents: toCents(r.amount) }));
}

/** CI getLossOfPayDaysByEmpId: the attendance register's LOP days, else the payroll attendance summary's absent days. */
export async function lopDays(db: Tx, emp: number, month: number, year: number): Promise<{ found: boolean; days: string | null }> {
  const [ar] = await db.$queryRaw<Array<{ days: string | null }>>`
    SELECT ar."LOSS_OF_PAY_DAYS" AS days FROM attendance_register ar JOIN emp_mst em ON em."REF_EMP_ID" = ar."USER_ID"
    WHERE em."EMP_ID" = ${emp} AND ar."MONTH" = ${month} AND ar."YEAR" = ${year} AND ar."IS_DELETED" = 0
    ORDER BY ar."ATTENDANCE_ID" DESC LIMIT 1`;
  if (ar) return { found: true, days: ar.days };
  const [s] = await db.$queryRaw<Array<{ days: number | null }>>`
    SELECT t."ABSENT_DAYS" AS days FROM payroll_attendance_summary t
    WHERE t."EMP_ID" = ${emp} AND t."CALENDAR_MONTH" = ${month} AND COALESCE(t."CALENDAR_YEAR", NULLIF(t."YEAR", 0)) = ${year} AND t."IS_DELETED" = 0
    ORDER BY t."PAS_ID" DESC LIMIT 1`;
  return s ? { found: true, days: s.days === null ? null : String(s.days) } : { found: false, days: null };
}

/** CI checkForSingleEmployeeTimesheetRecords: every timesheet period of the month needs a submitted, approved timesheet. */
export async function timesheetIssues(db: Tx, brand: number, emp: number, month: number, year: number): Promise<Array<{ period: string; status: string }> | null> {
  const [ts] = await db.$queryRaw<Array<{ id: number }>>`
    SELECT te."TS_EMP_ID" AS id FROM timesheet_employee te JOIN emp_mst em ON em."REF_EMP_ID" = te."REF_EMP_ID"
    WHERE em."EMP_ID" = ${emp} AND te."IS_DELETED" = 0 ORDER BY te."TS_EMP_ID" LIMIT 1`;
  // Employees without a timesheet record are not gated (CI failed with an SQL error).
  if (!ts) return null;
  const periods = await db.$queryRaw<Array<{ period: string | null; status: number | null; name: string | null; code: string | null }>>`
    SELECT p."FISCAL_PERIOD_DESC" AS period, x.status, im."MSTR_NM" AS name, im."MSTR_CD" AS code
    FROM period_mst p
    LEFT JOIN LATERAL (
      SELECT t."TS_STATUS_ID" AS status FROM timesheet t
      WHERE t."IS_DELETED" = 0 AND t."PERIOD_ID" = p."PERIOD_ID" AND t."TS_EMP_ID" = ${Number(ts.id)}
      ORDER BY (t."TS_STATUS_ID" = (SELECT "MSTR_ID" FROM independent_mst WHERE "MSTR_CD" = 'RJT' ORDER BY "MSTR_ID" LIMIT 1)), t."TS_ID" DESC LIMIT 1) x ON true
    LEFT JOIN independent_mst im ON im."MSTR_ID" = x.status
    WHERE p."OA_BRAND_ID" = ${brand} AND p."IS_DELETED" = 0
      AND p."PERIOD_TYPE_ID" = (SELECT "MSTR_ID" FROM independent_mst WHERE "MSTR_CD" = 'OPTS' ORDER BY "MSTR_ID" LIMIT 1)
      AND p."PERIOD_STATUS_ID" = (SELECT "MSTR_ID" FROM independent_mst WHERE "MSTR_CD" = 'OPSA' ORDER BY "MSTR_ID" LIMIT 1)
      AND (p."PERIOD_START_DATE" BETWEEN make_date(${year}::int, ${month}::int, 1) AND (make_date(${year}::int, ${month}::int, 1) + interval '1 month - 1 day')::date
        OR p."PERIOD_END_DATE" BETWEEN make_date(${year}::int, ${month}::int, 1) AND (make_date(${year}::int, ${month}::int, 1) + interval '1 month - 1 day')::date)
    ORDER BY p."PERIOD_ID"`;
  const bad = periods.filter((p) => p.status === null || ['DRFT', 'APPN', 'RJT'].includes(p.code ?? ''));
  return bad.length ? periods.map((p) => ({ period: p.period ?? '', status: p.status === null ? 'Not Found' : (p.name ?? '') })) : null;
}

/** P1 outdoor_allowance.md §6.3: eligible Outdoor Allowance days of the month (records summed). */
export async function odaDays(db: Tx, emp: number, month: number, year: number): Promise<number> {
  const [r] = await db.$queryRaw<Array<{ days: number }>>`
    WITH b AS (SELECT make_date(${year}::int, ${month}::int, 1) AS f, (make_date(${year}::int, ${month}::int, 1) + interval '1 month - 1 day')::date AS l)
    SELECT COALESCE(SUM(LEAST(t."END_DATE"::date, b.l) - GREATEST(t."START_DATE"::date, b.f) + 1), 0)::int AS days
    FROM outdoor_allowance t, b
    WHERE t."EMP_ID" = ${emp} AND COALESCE(t."IS_DELETED", 0) = 0 AND btrim(t."IS_ELIGIBLE_ODA") = '1'
      AND t."START_DATE"::date <= b.l AND t."END_DATE"::date >= b.f`;
  return Number(r?.days ?? 0);
}

/** CI getLoanInstallmentsByEmpId: unpaid instalments of open loans due in the month, in cents. */
export async function loanInstalmentsDue(db: Tx, emp: number, month: number, year: number): Promise<number> {
  const [r] = await db.$queryRaw<Array<{ total: string }>>`
    SELECT COALESCE(SUM(s."INSTALMENT_AMT_PAID"), 0)::text AS total
    FROM loan_repayment_schedule s
    JOIN loan_mst lm ON lm."LOAN_ID" = s."LOAN_ID"
    JOIN loan_employee le ON le."LOAN_EMP_ID" = lm."EMP_ID"
    JOIN emp_mst em ON em."REF_EMP_ID" = le."REF_EMP_ID"
    WHERE em."EMP_ID" = ${emp} AND extract(month FROM s."LOAN_REPAY_DATE") = ${month} AND extract(year FROM s."LOAN_REPAY_DATE") = ${year}
      AND s."IS_DELETED" = false AND COALESCE(s."PAYMENT_RECEIVED_FLAG", 0) = 0 AND lm."IS_DELETED" = 0
      AND lm."LOAN_STATUS_ID" IS DISTINCT FROM (SELECT "MSTR_ID" FROM independent_mst WHERE "MSTR_CD" = 'LSC' ORDER BY "MSTR_ID" LIMIT 1)`;
  return toCents(r?.total ?? '0');
}

/** The month's figures Generate Salary pays and recovers, as the "More Options" boxes show them (cents). */
export async function runInputs(db: Tx, emp: number, month: number, year: number) {
  const [incentive, advance, loanInstalments] = await Promise.all([
    incentiveTotal(db, emp, month, year),
    advanceSalaryPayrollInputs(db, emp, month, year),
    loanInstalmentsDue(db, emp, month, year),
  ]);
  return { incentive, loanDisbursed: 0, commission: 0, advance: advance.advance, advanceRepayment: advance.repayment, loanInstalments };
}

/** The employee's live payslip of the month, if any. */
export async function existingPayslip(db: Tx, prstps: number, emp: number, month: number, year: number) {
  const [p] = await db.$queryRaw<Array<{ id: number; paid: number }>>`
    SELECT "EMP_SAL_ID" AS id, "TRANSACTION_STATUS" AS paid FROM emp_basic_sal_mst
    WHERE "EMP_ID" = ${emp} AND "SAL_TYPE" = ${prstps} AND "IS_DELETED" = 0
      AND btrim("MONTH") ~ '^[0-9]{1,2}$' AND btrim("MONTH")::int = ${month} AND btrim("YEAR") = ${String(year)}
    ORDER BY "EMP_SAL_ID" DESC LIMIT 1`;
  return p ? { id: Number(p.id), paid: Number(p.paid) > 0 } : null;
}

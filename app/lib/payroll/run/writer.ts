import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import type { Tx } from '@/lib/employeeMngt/hub/hubEngine';
import { centsText } from '../annexure/ruleMath';
import { upsertPendingDeductions } from '../incentive';
import { addToSalaryBreakup, readSalaryBreakup, setSalaryBreakupBase, snapshotSalaryBreakup } from '../salaryBreakup';
import { computeTds, nonTaxableYearly, type TaxRule, type TdsResult } from '../tds/compute';
import { breakupDeltas, computePayslip, finishPayslip, type Cents, type PayslipResult } from './compute';
import {
  annexureLines, currentAnnexures, existingPayslip, lopDays, monthText, odaDays, runInputs, timesheetIssues,
  type EmployeeRecord, type RunContext, type TaxSetup,
} from './context';

/**
 * One employee's payslip of the run, written in the caller's transaction (CI generateSalaryDetails' loop body, no
 * transaction): the gates with CI's messages, then the header and the copied annexure rows, the salary breakup
 * (copied rows → snapshot → the run's rows), the run's rows, the header's net pay, the Professional Tax breakup and the
 * "Pending Deductions" arrear. The payslip delete (../payslip/delete.ts) reverts the same breakup deltas.
 *
 * Behaviour changes: an existing payslip of the month is refused — delete it first (CI deleted the header only, left
 * its rows and added everything to the breakup again); the former-employee gate applies to every employee of a run;
 * an employee without a timesheet record is not held back by the timesheet check; the LOP days must be a number
 * between 0 and the days of the month; the run's rows carry the employee's user, grade, position and currency (CI: 0)
 * and the LOP days (on the LOP row); the header's audit columns are set; the Professional Tax breakup's yearly total is
 * the sum of its months (CI added the month again on every re-run).
 */
export interface Overrides {
  incentive?: Cents;
  loanDisbursed?: Cents;
  commission?: Cents;
  advance?: Cents;
  advanceRepayment?: Cents;
  loanInstalments?: Cents;
  absentDays?: number;
}

export interface EmployeeOutcome {
  empId: number;
  name: string;
  status: 'generated' | 'skipped' | 'needs_timesheet_exception';
  message: string;
  id?: number;
  net?: string;
  periods?: Array<{ period: string; status: string }>;
  warnings?: string[];
}

/** A gate refused the employee: nothing of theirs is written. */
export class SkipEmployee extends Error {
  constructor(message: string, readonly status: 'skipped' | 'needs_timesheet_exception' = 'skipped', readonly periods?: Array<{ period: string; status: string }>) {
    super(message);
  }
}

/**
 * The FY's tax rules that apply to the employee (CI calculateTDS' rule reads): the regime's slabs (gender, country,
 * tax allowance type), standard deductions, rebates, marginal relief (new regime), cess and the non-taxable
 * components' rules in settings order. Shared with the investment declarations' tax summary.
 */
export function employeeTaxRules(
  t: TaxSetup,
  m: { SCINTX: number; SFMINUS: number },
  e: Pick<EmployeeRecord, 'gender' | 'taxAllowanceType'>,
  isNew: boolean,
) {
  const gender = (r: TaxRule) => r.gender === null || r.gender === 0 || r.gender === e.gender;
  const country = (r: { country: number | null }) => t.country === null || r.country === t.country;
  const regime = (r: TaxRule) => (r.newRegime ?? false) === isNew;
  const slabs = t.rules.filter((r) => r.component === m.SCINTX && r.sign === m.SFMINUS && regime(r) && gender(r) && country(r)
    && (r.taxAllowanceType === null || r.taxAllowanceType === 0 || r.taxAllowanceType === e.taxAllowanceType));
  const flat = t.rules.filter((r) => r.ruleType !== null && r.ruleType === t.rt.BRTYFDR && regime(r)).map((r) => r.values);
  const rebates = t.rules.filter((r) => r.ruleType !== null && r.ruleType === t.rt.BRTYRBE && regime(r) && gender(r) && country(r));
  const relief = t.rules.filter((r) => r.ruleType !== null && r.ruleType === t.rt.BRTYMRF && r.newRegime === true && country(r));
  const cess = t.rules.filter((r) => r.dependent === String(m.SCINTX) && gender(r) && country(r));
  const order = new Map(t.nonTaxableComponents.map((c, i) => [c, i]));
  const nonTaxableRules = t.rules
    .filter((r) => r.component !== null && order.has(r.component) && gender(r))
    .sort((a, b) => order.get(a.component!)! - order.get(b.component!)!);
  return { slabs, flat, rebates, relief, cess, nonTaxableRules };
}

/** CI calculateTDS via getTDSByEmpAndFY: the month's income tax (cents) for this payslip. */
async function incomeTax(tx: Tx, ctx: RunContext, e: EmployeeRecord, breakup: Record<string, Cents>, lopCents: Cents, snapshot: Record<string, Cents>): Promise<{ cents: Cents; detail: TdsResult }> {
  const t = ctx.tax!;
  const ci = t.mode === 'ci';
  const [job] = ci
    ? await tx.$queryRaw<Array<{ r: boolean | null }>>`SELECT "NEW_REGIME" AS r FROM job_mst WHERE "EMP_ID" = ${e.id} AND "IS_DELETED" = 0 ORDER BY "JOB_ID" ASC LIMIT 1`
    : await tx.$queryRaw<Array<{ r: boolean | null }>>`SELECT "NEW_REGIME" AS r FROM job_mst WHERE "EMP_ID" = ${e.id} AND "IS_DELETED" = 0 ORDER BY "JOB_ID" DESC LIMIT 1`;
  if (!ci && (job?.r === null || job?.r === undefined)) throw new SkipEmployee("The employee's job record does not say which tax regime applies (New Tax Regime).");
  const isNew = job?.r === true;
  const m = ctx.masters;
  const { slabs, flat, rebates, relief, cess, nonTaxableRules } = employeeTaxRules(t, m, e, isNew);
  const monthly = (snapshot.MONTHLY_SALARY ?? 0) / 100;

  let investments = 0;
  if (!isNew) {
    const [d] = await tx.$queryRaw<Array<{ a: string | null }>>`
      SELECT "ACTUAL_AMOUNT"::text AS a FROM investment_mst_declaration WHERE "EMP_ID" = ${e.id} AND "FY_ID" = ${ctx.fy.id} AND "IS_DELETED" = 0 ORDER BY "ID" LIMIT 1`;
    investments = Number(d?.a ?? 0);
  }
  let taxPaid: number;
  if (ci) taxPaid = (breakup.INCOME_TAX ?? 0) / 100;
  else {
    // What the FY's earlier payslips deducted (CI: the breakup's running total, wrong after a re-run).
    const [p] = await tx.$queryRaw<Array<{ paid: string }>>`
      SELECT COALESCE(SUM(d."ACTUAL_AMOUNT"), 0)::text AS paid
      FROM emp_basic_sal_mst h JOIN emp_basic_sal_dtl d ON d."SAL_MST_ID" = h."EMP_SAL_ID" AND d."IS_DELETED" = 0 AND d."SAL_COMP_ID" = ${m.SCINTX}
      WHERE h."EMP_ID" = ${e.id} AND h."SAL_TYPE" = ${m.PRSTPS} AND h."IS_DELETED" = 0
        AND btrim(h."MONTH") ~ '^[0-9]{1,2}$' AND btrim(h."YEAR") ~ '^[0-9]{4}$'
        AND make_date(btrim(h."YEAR")::int, btrim(h."MONTH")::int, 1) >= date_trunc('month', ${ctx.fy.start}::date)
        AND make_date(btrim(h."YEAR")::int, btrim(h."MONTH")::int, 1) < make_date(${ctx.year}::int, ${ctx.month}::int, 1)`;
    taxPaid = Number(p?.paid ?? 0);
  }
  const detail = computeTds({
    mode: t.mode, regime: isNew ? 'new' : 'old', month: ctx.month, year: ctx.year, fyEnd: t.fyEnd,
    // CI: ANNUAL_SALARY before this month's incentive (it counts from next month).
    annualIncome: (breakup.ANNUAL_SALARY ?? 0) / 100,
    lopYtd: ((breakup.LOP_DEDUCTIONS ?? 0) + lopCents) / 100,
    nonTaxable: nonTaxableYearly(nonTaxableRules, monthly, t.codes, t.mode),
    flatDeductions: flat, investments, slabs, rebates, marginalRelief: relief, taxDependents: cess, codes: t.codes,
    taxPaid, considerTaxPaid: true,
  });
  if (detail.warnings.includes('no-slabs') && !ci) {
    throw new SkipEmployee(`No income-tax slabs for the ${isNew ? 'new' : 'old'} regime in financial year ${ctx.fy.name ?? ctx.fy.id}.`);
  }
  return { cents: detail.monthlyTdsCents, detail };
}

/** CI upsertInPTBreakup: the month's Professional Tax in the calendar year's row; the year's total = Σ months. */
export async function setPtMonth(tx: Tx, v: { emp: number; month: number; year: number; cents: Cents | null; oa: number; brand: number; user: number; actor: number }) {
  const col = `"M_${v.month}"`;
  const sum = Array.from({ length: 12 }, (_, i) => `COALESCE("M_${i + 1}", 0)`).join(' + ');
  const amount = centsText(v.cents ?? 0);
  if (v.cents === null) {
    await tx.$executeRawUnsafe(
      `UPDATE professional_tax SET ${col} = 0, "ANNUAL_PAYMENT" = ${sum} - COALESCE(${col}, 0), "UPDATED_BY" = $3::int, "UPDATED_ON" = now()
       WHERE "EMP_ID" = $1::int AND "YEAR" = $2::int AND "IS_DELETED" = 0`,
      v.emp, v.year, v.actor,
    );
    return;
  }
  await assertInsertSafe('professional_tax', 'PT_ID');
  await tx.$executeRawUnsafe(
    `WITH upd AS (
       UPDATE professional_tax SET ${col} = $3::numeric, "ANNUAL_PAYMENT" = ${sum} - COALESCE(${col}, 0) + $3::numeric, "UPDATED_BY" = $7::int, "UPDATED_ON" = now()
       WHERE "PT_ID" = (SELECT "PT_ID" FROM professional_tax WHERE "EMP_ID" = $1::int AND "YEAR" = $2::int AND "IS_DELETED" = 0 ORDER BY "PT_ID" LIMIT 1)
       RETURNING 1)
     INSERT INTO professional_tax ("EMP_ID", "YEAR", ${col}, "ANNUAL_PAYMENT", "IS_DELETED", "OA_ID", "OA_BRAND_ID", "USER_ID", "CREATED_BY", "CREATED_ON", "UPDATED_BY", "UPDATED_ON")
     SELECT $1::int, $2::int, $3::numeric, $3::numeric, 0, $4::int, $5::int, $6::int, $7::int, now(), $7::int, now()
     WHERE NOT EXISTS (SELECT 1 FROM upd)`,
    v.emp, v.year, amount, v.oa, v.brand, v.user, v.actor,
  );
}

/**
 * Runs the gates and computes the employee's payslip; with `write` it is saved. Throws SkipEmployee when a gate refuses.
 * The caller owns the transaction (one per employee; a preview's is rolled back).
 */
export async function generateEmployeePayslip(
  tx: Tx,
  ctx: RunContext,
  e: EmployeeRecord,
  opts: { actor: number; overrides?: Overrides; timesheetException: boolean },
): Promise<{ payslipId: number; result: PayslipResult; tax: TdsResult | null }> {
  const m = ctx.masters;
  const period = monthText(ctx.month, ctx.year);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${e.id}:${ctx.year * 100 + ctx.month}`}))`;

  const existing = await existingPayslip(tx, m.PRSTPS, e.id, ctx.month, ctx.year);
  if (existing?.paid) throw new SkipEmployee(`Salary already paid for ${period}. Mark it unpaid and delete it to regenerate.`);
  if (existing) throw new SkipEmployee(`Salary already generated for ${period}. Delete the payslip first to regenerate it.`);
  if (e.left && e.left < `${ctx.year}-${String(ctx.month).padStart(2, '0')}-01`) throw new SkipEmployee('Sorry selected employee is former. Salary Slip cannot be generated');

  const annexures = await currentAnnexures(tx, ctx, e.id);
  if (!annexures.length) throw new SkipEmployee('Please generate annexure or Mark Current annexure');
  if (annexures.length > 1) throw new SkipEmployee('More than one annexure is marked current. Mark only one as current.');
  const annexure = { ...annexures[0], lines: await annexureLines(tx, annexures[0].id) };

  const attendance = await lopDays(tx, e.id, ctx.month, ctx.year);
  if (!attendance.found) throw new SkipEmployee('Attendance Record does not exist please generate the Attendance');
  const rawDays = opts.overrides?.absentDays ?? Number(String(attendance.days ?? '').trim() || 0);
  if (!Number.isFinite(rawDays) || rawDays < 0 || rawDays > ctx.setup.days) {
    throw new SkipEmployee(`The LOP days of ${period} (${attendance.days}) must be a number between 0 and ${ctx.setup.days}.`);
  }
  if (!opts.timesheetException) {
    const issues = await timesheetIssues(tx, ctx.brand, e.id, ctx.month, ctx.year);
    if (issues) throw new SkipEmployee('Timesheet Issue', 'needs_timesheet_exception', issues);
  }

  const inputs = { ...(await runInputs(tx, e.id, ctx.month, ctx.year)) };
  for (const k of ['incentive', 'loanDisbursed', 'commission', 'advance', 'advanceRepayment', 'loanInstalments'] as const) {
    const v = opts.overrides?.[k];
    if (v !== undefined) inputs[k] = v;
  }

  // CI insertSalaryBreakup: the FY row from the annexure when the year has none yet.
  let breakup = await readSalaryBreakup(tx, e.id, ctx.fy.id);
  if (!breakup) {
    await setSalaryBreakupBase(tx, 'salary_breakup', {
      emp: e.id, fy: ctx.fy.id, monthly: centsText(annexure.actualCents), gross: centsText(annexure.actualCents * 12),
      oa: e.oa ?? ctx.oa, brand: ctx.brand, user: e.user ?? opts.actor, by: opts.actor,
    });
    breakup = (await readSalaryBreakup(tx, e.id, ctx.fy.id))!;
  }

  const draft = computePayslip(ctx.setup, {
    empId: e.id, gender: e.gender, isDisabled: e.isDisabled, annexure, lopDays: rawDays, inputs,
    odaDays: ctx.setup.oda ? await odaDays(tx, e.id, ctx.month, ctx.year) : 0, breakup,
  });
  const tax = ctx.tax ? await incomeTax(tx, ctx, e, breakup, draft.lopCents, draft.snapshot) : null;
  const result = finishPayslip(ctx.setup, draft, tax ? tax.cents : null);

  // Header: the annexure's header for this month (CI replicateSalaryMasterForEmployees).
  await assertInsertSafe('emp_basic_sal_mst', 'EMP_SAL_ID');
  await assertInsertSafe('emp_basic_sal_dtl', 'EMP_BASIC_SAL_DTL_ID');
  const mm = String(ctx.month).padStart(2, '0');
  const yyyy = String(ctx.year);
  const [header] = await tx.$queryRaw<Array<{ id: number; grade: number | null; position: number | null; currency: number | null; oa: number | null; user: number | null }>>`
    INSERT INTO emp_basic_sal_mst ("EMP_ID", "DEPT_ID", "EMP_GRADE_ID", "POSITION_ID", "CURRENCY_ID", "ACTUAL_AMOUNT", "EARNED_AMOUNT", "SAL_TYPE",
      "PAY_FREQUENCY_ID", "TRANSACTION_STATUS", "MONTH", "YEAR", "EFFECTIVE_DATE", "IS_CURRENT", "COMMENTS", "IS_GENERATED", "IS_DELETED",
      "CREATED_BY", "CREATED_ON", "UPDATED_BY", "UPDATED_ON", "OA_ID", "OA_BRAND_ID", "USER_ID")
    SELECT a."EMP_ID", a."DEPT_ID", a."EMP_GRADE_ID", a."POSITION_ID", a."CURRENCY_ID", a."ACTUAL_AMOUNT", ${centsText(result.earnedCents)}::numeric, ${m.PRSTPS},
      a."PAY_FREQUENCY_ID", 0, ${mm}, ${yyyy}, NULL, 0, COALESCE(a."COMMENTS", ''), 1, 0,
      ${opts.actor}, now(), ${opts.actor}, now(), COALESCE(a."OA_ID", ${e.oa ?? ctx.oa}), ${ctx.brand}, COALESCE(a."USER_ID", ${e.user})
    FROM emp_basic_sal_mst a WHERE a."EMP_SAL_ID" = ${annexure.id}
    RETURNING "EMP_SAL_ID" AS id, "EMP_GRADE_ID" AS grade, "POSITION_ID" AS position, "CURRENCY_ID" AS currency, "OA_ID" AS oa, "USER_ID" AS "user"`;
  const payslipId = Number(header.id);

  // The annexure's rows, in their order (CI replicateSalaryDetailsForEmployees).
  await tx.$executeRaw`
    INSERT INTO emp_basic_sal_dtl ("EMP_ID", "SAL_MST_ID", "DEPT_ID", "EMP_GRADE_ID", "POSITION_ID", "CURRENCY_ID", "SAL_COMP_ID", "PAY_GROUP_HEAD_ID",
      "ACTUAL_AMOUNT", "EARNED_AMOUNT", "BASIC_SALARY", "PAY_FREQUENCY_ID", "MONTH", "YEAR", "COMPONENT_DESC", "COMMENTS", "IS_DELETED",
      "CREATED_BY", "CREATED_ON", "UPDATED_BY", "UPDATED_ON", "OA_ID", "OA_BRAND_ID", "USER_ID")
    SELECT d."EMP_ID", ${payslipId}, d."DEPT_ID", d."EMP_GRADE_ID", d."POSITION_ID", d."CURRENCY_ID", d."SAL_COMP_ID", d."PAY_GROUP_HEAD_ID",
      d."ACTUAL_AMOUNT", d."EARNED_AMOUNT", d."BASIC_SALARY", d."PAY_FREQUENCY_ID", ${mm}, ${yyyy}, d."COMPONENT_DESC", d."COMMENTS", 0,
      ${opts.actor}, now(), ${opts.actor}, now(), d."OA_ID", d."OA_BRAND_ID", d."USER_ID"
    FROM emp_basic_sal_dtl d
    WHERE d."SAL_MST_ID" = ${annexure.id} AND d."IS_DELETED" = 0 AND d."SAL_COMP_ID" IS NOT NULL
    ORDER BY d."EMP_BASIC_SAL_DTL_ID"`;

  // The year's breakup: the copied rows, the snapshot the rules read (taken from the same figures), the run's rows.
  const deltas = breakupDeltas(result.lines, ctx.setup);
  await addToSalaryBreakup(tx, e.id, ctx.fy.id, deltas.copy, opts.actor);
  await snapshotSalaryBreakup(tx, e.id, ctx.fy.id, ctx.month, ctx.year);
  await addToSalaryBreakup(tx, e.id, ctx.fy.id, deltas.run, opts.actor);

  // The run's rows (every one, 0.00 included — the payslip prints them).
  const run = result.lines.filter((l) => l.source === 'run');
  if (run.length) {
    await tx.$executeRaw`
      INSERT INTO emp_basic_sal_dtl ("EMP_ID", "SAL_MST_ID", "DEPT_ID", "EMP_GRADE_ID", "POSITION_ID", "CURRENCY_ID", "SAL_COMP_ID", "PAY_GROUP_HEAD_ID",
        "ACTUAL_AMOUNT", "EARNED_AMOUNT", "PAY_FREQUENCY_ID", "MONTH", "YEAR", "COMPONENT_DESC", "COMMENTS", "IS_DELETED",
        "CREATED_BY", "CREATED_ON", "UPDATED_BY", "UPDATED_ON", "OA_ID", "OA_BRAND_ID", "USER_ID")
      SELECT ${e.id}, ${payslipId}, NULL, ${header.grade ?? 0}, ${header.position ?? 0}, ${header.currency ?? 0}, x.component, NULL,
        x.amount, x.amount, ${ctx.frequency}, ${mm}, ${yyyy}, x.descr, '', 0,
        ${opts.actor}, now(), ${opts.actor}, now(), ${header.oa ?? ctx.oa}, ${ctx.brand}, ${header.user ?? e.user ?? 0}
      FROM unnest(${run.map((l) => l.component)}::int[], ${run.map((l) => centsText(l.cents))}::numeric[], ${run.map((l) => l.desc ?? '')}::text[])
        WITH ORDINALITY AS x(component, amount, descr, n)
      ORDER BY x.n`;
  }

  if (result.ptCents !== null) {
    await setPtMonth(tx, { emp: e.id, month: ctx.month, year: ctx.year, cents: result.ptCents, oa: e.oa ?? ctx.oa, brand: ctx.brand, user: e.user ?? 0, actor: opts.actor });
  }
  if (result.arrearCents !== null && result.arrearCents < 0) {
    await upsertPendingDeductions(tx, {
      empId: e.id, month: ctx.month, year: ctx.year, cents: result.arrearCents, type: m.MACINARR,
      oa: e.oa ?? ctx.oa, brand: ctx.brand, user: e.user ?? opts.actor, actor: opts.actor,
    });
  }
  return { payslipId, result, tax: tax?.detail ?? null };
}

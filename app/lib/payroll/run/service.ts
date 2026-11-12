import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { fullName } from '@/lib/employeeMngt/hub/hubEngine';
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { centsText } from '../annexure/ruleMath';
import { payslipDocumentService, readPayslipDocument, type PayslipDocumentData } from '../payslip/document';
import type { TdsMode } from '../tds/compute';
import { employeeRecord, loadRunContext, lopDays, monthText, runInputs, type RunContext } from './context';
import { generateEmployeePayslip, SkipEmployee, type EmployeeOutcome, type Overrides } from './writer';

/**
 * CI emp_sal_component_mst::generateSalaryDetails and the Generate Salary modal's pre-fills (getAbsentDays,
 * getIncentive, getLoanInstallments, advance_salary getAdvanceSalary / getAdvanceSalRepayment): Payroll Processing's
 * "Generate Salary" — the payslips of a month for one, several or all employees of the active brand, a preview of one
 * employee's payslip, and the "More Options" figures of one employee.
 *
 * Behaviour changes: admins with the menu's add grant only (CI's URLs were open to anyone, with any brand's
 * employees); the month must be MM/YYYY and not in the future; a run of several or all employees computes each
 * employee's incentives, advances and loan instalments itself (CI paid none of them unless one employee was run —
 * one employee may still override them); "All employees" are the brand's current employees and those who left in or
 * after the month, with a current annexure (CI took every employee ever registered); each employee is written in its
 * own transaction and one employee's problem skips only that employee; the preview is the same calculation, rolled
 * back, rendered as a PDF (CI wrote temp tables and a public file); the result is a list per employee.
 */
const MENU = 'employeeMngt/emp_sal_component_mst';
const MONTH_RE = /^(0?[1-9]|1[0-2])\/(\d{4})$/;

const amount = z.union([z.number(), z.string().trim()]).optional();
const schema = z.object({
  empIds: z.union([z.literal('all'), z.array(z.coerce.number().int().positive()).max(500)]),
  monthYear: z.string().trim().default(''),
  inputs: z
    .object({
      incentivesArrears: amount, totalHours: amount, absentDays: amount, commissions: amount, loanDisbursed: amount,
      advanceSalary: amount, advanceRepayment: amount, loanInstallments: amount,
    })
    .partial()
    .optional(),
  timesheetExceptions: z.array(z.coerce.number().int().positive()).max(5000).optional(),
});

const LABELS = {
  incentivesArrears: 'Incentives/Arrears', totalHours: 'Total Hours', absentDays: 'Absent Days', commissions: 'Commission',
  loanDisbursed: 'Loans Disbursed', advanceSalary: 'Advance Salary', advanceRepayment: 'Advance Repayment', loanInstallments: 'Loans Installment',
} as const;

interface ParsedRun {
  brand: number;
  month: number;
  year: number;
  ids: number[] | 'all';
  overrides?: Overrides;
  exceptions: Set<number>;
}

async function authorise(subject: RequestSubject): Promise<number> {
  if (subject.adminLevel === 0 || !(await menuPolicy(MENU).check(subject, 'create'))) throw new ForbiddenError();
  const brand = subject.oaBrandId ?? null;
  if (!brand) throw new BusinessRuleError('Select a brand first.');
  return brand;
}

function parseMonth(raw: string, field = 'monthYear') {
  const m = MONTH_RE.exec(raw.trim());
  const now = new Date();
  if (!raw.trim()) throw new ValidationError('Validation failed.', { [field]: ['The Month / Year field is required.'] });
  if (!m || Number(m[2]) < 1900 || Number(m[2]) > 2100) throw new ValidationError('Validation failed.', { [field]: ['The Month / Year field must be in MM/YYYY format.'] });
  if (Number(m[2]) * 12 + Number(m[1]) > now.getUTCFullYear() * 12 + now.getUTCMonth() + 1) {
    throw new ValidationError('Validation failed.', { [field]: ['The Month / Year cannot be in the future.'] });
  }
  return { month: Number(m[1]), year: Number(m[2]) };
}

async function parseRun(subject: RequestSubject, body: unknown, mode: 'final' | 'preview'): Promise<ParsedRun> {
  const brand = await authorise(subject);
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) throw new ValidationError('Validation failed.', { empIds: ['The Employee field is required.'] });
  const v = parsed.data;
  const { month, year } = parseMonth(v.monthYear);
  let ids: number[] | 'all' = v.empIds;
  if (ids !== 'all') {
    ids = [...new Set(ids)];
    if (!ids.length) throw new ValidationError('Validation failed.', { empIds: ['The Employee field is required.'] });
    const [valid] = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM emp_mst WHERE "EMP_ID" = ANY(${ids}::int[]) AND "IS_DELETED" = 0 AND "OA_BRAND_ID" = ${brand}`;
    if (valid.n !== ids.length) throw new ValidationError('Validation failed.', { empIds: ['Select a valid Employee.'] });
  }
  if (mode === 'preview' && (ids === 'all' || ids.length !== 1)) throw new ValidationError('Validation failed.', { empIds: ['Preview needs exactly one employee.'] });

  // "More Options": only for a single employee (several / all: the server's own figures).
  let overrides: Overrides | undefined;
  if (v.inputs && ids !== 'all' && ids.length === 1) {
    const errors: Record<string, string[]> = {};
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const read = (key: keyof typeof LABELS, allowNegative = false): number | undefined => {
      const raw = v.inputs?.[key];
      if (raw === undefined || raw === null || raw === '') return undefined;
      const x = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(x) || (!allowNegative && x < 0) || Math.abs(Math.round(x * 100) - x * 100) > 1e-6) {
        errors[key] = [`The ${LABELS[key]} field must be ${allowNegative ? 'a number' : 'a positive number'} with at most 2 decimals.`];
        return undefined;
      }
      return x;
    };
    const cents = (x: number | undefined) => (x === undefined ? undefined : Math.round(x * 100));
    const absent = read('absentDays');
    if (absent !== undefined && (absent > days || Math.round(absent * 2) !== absent * 2)) {
      errors.absentDays = [absent > days ? `The Absent Days field cannot be more than the ${days} days of the month.` : 'The Absent Days field must be in half days.'];
    }
    const commission = read('commissions');
    if (commission && !(await getMasterId('PCCOMMS'))) errors.commissions = ['Commission cannot be paid: its salary component (PCCOMMS) is not set up.'];
    overrides = {
      incentive: cents(read('incentivesArrears', true)), loanDisbursed: cents(read('loanDisbursed')), commission: cents(commission),
      advance: cents(read('advanceSalary')), advanceRepayment: cents(read('advanceRepayment')), loanInstalments: cents(read('loanInstallments')),
      absentDays: errors.absentDays ? undefined : absent,
    };
    read('totalHours'); // hourly basis only (not supported); validated, unused
    if (Object.keys(errors).length) throw new ValidationError('Validation failed.', errors);
  }
  return { brand, month, year, ids, overrides, exceptions: new Set(v.timesheetExceptions ?? []) };
}

/** "All employees": current employees and those who left in or after the month, with a current annexure. */
async function allEmployees(ctx: RunContext): Promise<number[]> {
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT em."EMP_ID" AS id FROM emp_mst em
    WHERE em."OA_BRAND_ID" = ${ctx.brand} AND em."IS_DELETED" = 0
      AND (em."EMP_STATUS_ID" = (SELECT "MSTR_ID" FROM independent_mst WHERE "MSTR_CD" = 'EMSC' ORDER BY "MSTR_ID" LIMIT 1)
           OR EXISTS (SELECT 1 FROM emp_termination_dtl t WHERE t."EMP_ID" = em."EMP_ID" AND t."IS_DELETED" = 0
                      AND t."TERMINATION_DATE" >= make_date(${ctx.year}::int, ${ctx.month}::int, 1)))
      AND EXISTS (SELECT 1 FROM emp_basic_sal_mst a WHERE a."EMP_ID" = em."EMP_ID" AND a."SAL_TYPE" = ${ctx.masters.PRSTAX}
                  AND a."PAY_FREQUENCY_ID" = ${ctx.frequency} AND a."IS_CURRENT" = 1 AND a."IS_DELETED" = 0)
    ORDER BY em."EMP_ID"`;
  return rows.map((r) => Number(r.id));
}

const skipped = (empId: number, name: string, err: SkipEmployee): EmployeeOutcome => ({
  empId, name, status: err.status, message: err.message, ...(err.periods ? { periods: err.periods } : {}),
});

class PreviewDone extends Error {
  constructor(readonly data: PayslipDocumentData) {
    super('preview');
  }
}

export const payrollRun = {
  /** The Generate Salary dialog: the brand's employees, the default month, what the caller may do. */
  async options(subject: RequestSubject) {
    const brand = subject.oaBrandId ?? null;
    const admin = subject.adminLevel > 0 && !!brand;
    const [generate, markPaid] = await Promise.all([
      admin ? menuPolicy(MENU).check(subject, 'create') : Promise.resolve(false),
      admin ? menuPolicy(MENU).check(subject, 'update') : Promise.resolve(false),
    ]);
    const employees = brand
      ? await prisma.$queryRawUnsafe<Array<{ value: number; label: string; code: string | null; status: string | null }>>(
        `SELECT em."EMP_ID" AS value, ${fullName('em')} AS label, em."EMP_NBR" AS code,
           (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = em."EMP_STATUS_ID" LIMIT 1) AS status
         FROM emp_mst em WHERE em."IS_DELETED" = 0 AND em."OA_BRAND_ID" = $1::int ORDER BY label, em."EMP_ID"`,
        brand,
      )
      : [];
    const now = new Date();
    const current = (s: string | null) => s === 'EMSC';
    return {
      employees: employees
        .sort((a, b) => Number(current(b.status)) - Number(current(a.status)))
        .map((r) => ({ value: Number(r.value), label: `${r.code ? `${r.label} (${r.code})` : r.label}${current(r.status) ? '' : ' (Former)'}` })),
      defaults: { monthYear: monthText(now.getUTCMonth() + 1, now.getUTCFullYear()) },
      permissions: { generate, markPaid },
      commission: !!(await getMasterId('PCCOMMS')),
      message: brand ? null : 'Select a brand first.',
    };
  },

  /** "More Options" of one employee and month: what the run would pay and recover. */
  async inputs(subject: RequestSubject, query: { emp?: string | null; monthYear?: string | null }) {
    const brand = await authorise(subject);
    const emp = Number(query.emp);
    const { month, year } = parseMonth(query.monthYear ?? '');
    const e = Number.isInteger(emp) && emp > 0 ? await employeeRecord(prisma, emp) : null;
    if (!e || e.brand !== brand) throw new NotFoundError('Record not found.');
    const [inputs, attendance] = await Promise.all([runInputs(prisma, emp, month, year), lopDays(prisma, emp, month, year)]);
    return {
      incentivesArrears: centsText(inputs.incentive),
      totalHours: '0',
      absentDays: attendance.found ? String(Number(String(attendance.days ?? '').trim() || 0)) : '0',
      absentDaysFound: attendance.found,
      advanceSalary: centsText(inputs.advance),
      advanceRepayment: centsText(inputs.advanceRepayment),
      loanInstallments: centsText(inputs.loanInstalments),
      commissions: '0.00',
      loanDisbursed: '0.00',
      message: attendance.found ? null : 'Attendance Record does not exist please generate the Attendance',
    };
  },

  /** `concurrency`: employees written at the same time (each in its own transaction and lock); tests use 1. */
  async generate(subject: RequestSubject, body: unknown, opts: { tdsMode?: TdsMode; concurrency?: number } = {}): Promise<{ results: EmployeeOutcome[]; message: string; warnings: string[] }> {
    const run = await parseRun(subject, body, 'final');
    const ctx = await loadRunContext(run.brand, run.month, run.year, opts);
    const ids = run.ids === 'all' ? await allEmployees(ctx) : run.ids;
    if (!ids.length) throw new BusinessRuleError('Please Update Salary In Employees Job Details And Generate Annexure');
    const one = async (id: number): Promise<EmployeeOutcome | null> => {
      const e = await employeeRecord(prisma, id);
      if (!e) return null;
      const exception = run.exceptions.has(id);
      try {
        const out = await prisma.$transaction(
          (tx) => generateEmployeePayslip(tx, ctx, e, { actor: subject.userId, overrides: ids.length === 1 ? run.overrides : undefined, timesheetException: exception }),
          { timeout: 60000 },
        );
        return {
          empId: id, name: e.name, status: 'generated', message: exception ? 'Salary Generated (Exception for Timesheet)' : 'Salary Generated',
          id: out.payslipId, net: centsText(out.result.earnedCents), ...(out.result.warnings.length ? { warnings: out.result.warnings } : {}),
        };
      } catch (err) {
        if (err instanceof SkipEmployee) return skipped(id, e.name, err);
        if (ids.length === 1) throw err;
        console.error(`payroll run: employee ${id}`, err);
        return { empId: id, name: e.name, status: 'skipped', message: `Salary could not be generated: ${err instanceof Error ? err.message : String(err)}` };
      }
    };
    const slots: Array<EmployeeOutcome | null> = new Array(ids.length).fill(null);
    let next = 0;
    const worker = async () => {
      while (next < ids.length) {
        const i = next++;
        slots[i] = await one(ids[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 4, ids.length)) }, worker));
    const results = slots.filter((r): r is EmployeeOutcome => r !== null);
    const done = results.filter((r) => r.status === 'generated').length;
    const message = results.length === 1 ? `${results[0].name} - ${results[0].message}` : `Salary generated: ${done}. Skipped: ${results.length - done}.`;
    return { results, message, warnings: ctx.taxWarning ? [ctx.taxWarning] : [] };
  },

  /** One employee's payslip as it would be generated, as a PDF — nothing is saved. Or the gate that refused it. */
  async preview(subject: RequestSubject, body: unknown): Promise<{ pdf: { name: string; data: Buffer } } | { results: EmployeeOutcome[]; message: string }> {
    const run = await parseRun(subject, body, 'preview');
    const ctx = await loadRunContext(run.brand, run.month, run.year);
    const id = (run.ids as number[])[0];
    const e = await employeeRecord(prisma, id);
    if (!e) throw new NotFoundError('Record not found.');
    try {
      await prisma.$transaction(async (tx) => {
        const out = await generateEmployeePayslip(tx, ctx, e, { actor: subject.userId, overrides: run.overrides, timesheetException: run.exceptions.has(id) });
        const data = await readPayslipDocument(tx, out.payslipId);
        if (!data) throw new Error('The preview payslip could not be read back.');
        throw new PreviewDone(data); // rolls the transaction back
      }, { timeout: 60000 });
    } catch (err) {
      if (err instanceof PreviewDone) return { pdf: payslipDocumentService.preview(err.data) };
      if (err instanceof SkipEmployee) {
        const r = skipped(id, e.name, err);
        return { results: [r], message: `${r.name} - ${r.message}` };
      }
      throw err;
    }
    throw new Error('unreachable');
  },
};

import type { Tx } from '@/lib/employeeMngt/hub/hubEngine';
import { prisma } from '@/lib/prisma';
import { phpFloat } from '../annexure/ruleMath';
import type { FinancialYear } from '../financialYear';
import { employeeRecord, loadDeltaSetup, loadTaxSetup, type TaxSetup } from '../run/context';
import { employeeTaxRules } from '../run/writer';
import { readSalaryBreakup } from '../salaryBreakup';
import { computeTds, nonTaxableYearly } from '../tds/compute';
import { brandCountry } from './rules';

/**
 * The tax figures of an employee's financial year as the payroll's TDS works them out (lib/payroll/tds, fixed mode):
 * CI emp_investment_declarations_m::getTotalTaxableIncome / getTotalTaxablePayable (the declaration page's "Total
 * Taxable Income" / "Total Tax Payable" cards) and the Tax Breakup export's taxable income and payable tax.
 * Taxable income = the FY salary breakup's ANNUAL_SALARY − LOP − the yearly "Deduct from Taxable Income" components
 * (Professional Tax) − the regime's standard deduction − (old regime) the declaration's ACTUAL_AMOUNT; the tax is the
 * year's slab tax − rebate (+ marginal relief, new regime) + cess.
 *
 * Behaviour changes: the regime is the employee's (CI's cards always took the investments off, also under the new
 * regime, where TDS ignores them); Professional Tax and the standard deduction are the amounts the tax uses (CI's
 * cards always showed 2500 and 50000); no salary breakup for the year gives no figures (CI showed negative numbers).
 */
export interface TaxYearSetup {
  brand: number;
  fy: FinancialYear;
  tax: TaxSetup;
  masters: Awaited<ReturnType<typeof loadDeltaSetup>>['masters'];
}

export interface TaxFigures {
  regime: 'old' | 'new';
  /** The job record does not say which regime applies (old is used, as CI). */
  regimeUnknown: boolean;
  annualSalary: number;
  lop: number;
  professionalTax: number;
  standardDeduction: number;
  /** Before the declared investments (CI exportTaxBreakup "Taxable Income"). */
  taxableBeforeInvestments: number;
  /** After them, when the regime allows (CI "Total Taxable Income" / "Balance Taxable amount after Investment Deduction"). */
  taxableIncome: number;
  /** The year's tax (CI "Total Tax Payable" / "Total Payable Tax Annually"). */
  taxPayable: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function financialYearById(id: number, db: Tx = prisma): Promise<FinancialYear | null> {
  const [fy] = await db.$queryRaw<Array<{ id: number; start: string | null; end: string | null; name: string | null }>>`
    SELECT "PERIOD_ID" AS id, to_char("PERIOD_START_DATE", 'YYYY-MM-DD') AS start, to_char("PERIOD_END_DATE", 'YYYY-MM-DD') AS "end",
      "FISCAL_PERIOD_DESC" AS name
    FROM period_mst WHERE "PERIOD_ID" = ${id}`;
  return fy?.start && fy.end ? { id: Number(fy.id), start: fy.start, end: fy.end, name: fy.name } : null;
}

/** The brand's tax rules of the year, loaded once (a page or an export). Null when the year has no dates. */
export async function loadTaxYear(brand: number, fyId: number): Promise<TaxYearSetup | null> {
  const fy = await financialYearById(fyId);
  if (!fy) return null;
  const [{ masters }, country] = await Promise.all([loadDeltaSetup(brand), brandCountry(brand)]);
  return { brand, fy, tax: await loadTaxSetup(brand, fy, country, masters, 'fixed'), masters };
}

/** The employee's figures for the year (`investments`: the declaration's ACTUAL_AMOUNT); null without a salary breakup. */
export async function employeeTaxFigures(setup: TaxYearSetup, empId: number, investments: number, db: Tx = prisma): Promise<TaxFigures | null> {
  const [breakup, e, job] = await Promise.all([
    readSalaryBreakup(db, empId, setup.fy.id),
    employeeRecord(db, empId),
    db.$queryRaw<Array<{ r: boolean | null }>>`SELECT "NEW_REGIME" AS r FROM job_mst WHERE "EMP_ID" = ${empId} AND "IS_DELETED" = 0 ORDER BY "JOB_ID" DESC LIMIT 1`,
  ]);
  if (!breakup || !e) return null;
  const regimeUnknown = job[0]?.r === null || job[0]?.r === undefined;
  const isNew = job[0]?.r === true;
  const t = setup.tax;
  const { slabs, flat, rebates, relief, cess, nonTaxableRules } = employeeTaxRules(t, setup.masters, e, isNew);
  const [sy, sm] = setup.fy.start.split('-').map(Number);
  const annualSalary = (breakup.ANNUAL_SALARY ?? 0) / 100;
  const lop = (breakup.LOP_DEDUCTIONS ?? 0) / 100;
  const professionalTax = nonTaxableYearly(nonTaxableRules, (breakup.MONTHLY_SALARY ?? 0) / 100, t.codes, 'fixed');
  const detail = computeTds({
    mode: 'fixed', regime: isNew ? 'new' : 'old', month: sm, year: sy, fyEnd: t.fyEnd, annualIncome: annualSalary, lopYtd: lop,
    nonTaxable: professionalTax, flatDeductions: flat, investments, slabs, rebates, marginalRelief: relief, taxDependents: cess,
    codes: t.codes, taxPaid: 0, considerTaxPaid: false,
  });
  const standardDeduction = flat.reduce((s, v) => s + phpFloat(v), 0);
  return {
    regime: isNew ? 'new' : 'old',
    regimeUnknown,
    annualSalary,
    lop,
    professionalTax: round2(professionalTax),
    standardDeduction: round2(standardDeduction),
    taxableBeforeInvestments: round2(annualSalary - lop - professionalTax - standardDeduction),
    taxableIncome: round2(detail.taxableIncome),
    taxPayable: round2(detail.yearlyTax),
  };
}

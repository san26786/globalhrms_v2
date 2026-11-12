import { phpFloat } from '../annexure/ruleMath';

/**
 * CI emp_sal_component_mst_m::calculateTDS — the monthly income tax (SCINTX) of a payslip, a pure function of the
 * inputs (loaded by ../run/context.ts). The year's taxable income is the FY salary breakup's ANNUAL_SALARY (the
 * annexure's yearly CTC plus earlier months' incentives) minus the year's LOP, the yearly amount of the components
 * flagged "Deduct from Taxable Income" (Professional Tax), the regime's standard deduction and — old regime — the
 * declared investments. Tax = the regime's slabs, minus the rebate (87A), capped by marginal relief (new regime), plus
 * cess; what the FY's earlier payslips deducted is subtracted and the rest is spread over the months left in the FY,
 * current month included, rounded to cents (the only rounding — PHP round()).
 *
 * `mode: 'ci'` reproduces the stored CI figures (parity tests). `mode: 'fixed'` (the payroll run) changes:
 *  - cess: one rule per cess component — the one of the employee's regime, else the regime-less / old one — banded on
 *    the tax (CI added every rule depending on SCINTX: GTPL's two 4 % rules charged 8 %);
 *  - months left are whole payroll months (CI's PHP < 8.1 time-zone diff gave March 1.0667, leaving ~6 % of the
 *    year's balance undeducted);
 *  - a partly used slab taxes the income above the previous slab's upper limit (CI: above this slab's lower limit,
 *    so GTPL's "x 001.00" limits left 1 rupee per slab untaxed);
 *  - the non-taxable components add each FY month's rule once (CI's loop re-added and skipped rules depending on the
 *    order — same 2 500 for the live Professional Tax rules).
 */
export type Regime = 'old' | 'new';
export type TdsMode = 'ci' | 'fixed';

export interface TaxRule {
  id: number;
  ruleType: number | null;
  component: number | null;
  factor: number;
  dependent: string;
  lower: number;
  /** UPPER_LIMIT text ('&infin;' on open rows). */
  upper: string;
  open: boolean;
  values: string;
  /** 0 = every month. */
  month: number;
  gender: number | null;
  newRegime: boolean | null;
}

export interface TdsCodes {
  CFP: number;
  CFFAC: number;
  CFCONR: number;
}

export interface TdsInputs {
  mode: TdsMode;
  regime: Regime;
  month: number;
  year: number;
  /** FY end, YYYY-MM-DD. */
  fyEnd: string;
  /** salary_breakup.ANNUAL_SALARY before this month's one-off additions (rupees). */
  annualIncome: number;
  /** salary_breakup.LOP_DEDUCTIONS including this month's LOP (rupees). */
  lopYtd: number;
  /** Yearly amount of the "Deduct from Taxable Income" components (nonTaxableYearly). */
  nonTaxable: number;
  /** VALUES of the regime's standard-deduction (BRTYFDR) rules. */
  flatDeductions: string[];
  /** Investment declaration ACTUAL_AMOUNT (old regime only). */
  investments: number;
  /** The regime's SCINTX slab rules, LOWER_LIMIT asc, MONTH desc, id asc. */
  slabs: TaxRule[];
  /** The regime's rebate (BRTYRBE) rules. */
  rebates: TaxRule[];
  /** Marginal relief (BRTYMRF) rules — new regime. */
  marginalRelief: TaxRule[];
  /** Rules depending on SCINTX (cess), every regime, LOWER_LIMIT asc, MONTH desc, id asc. */
  taxDependents: TaxRule[];
  codes: TdsCodes;
  /** Tax already deducted in the FY (rupees). */
  taxPaid: number;
  considerTaxPaid: boolean;
  monthsLeftOverride?: number;
}

export interface TdsResult {
  taxableIncome: number;
  slabLines: Array<{ ruleId: number; taxed: number; rate: number; tax: number }>;
  slabTax: number;
  rebate: number;
  marginalReliefApplied: boolean;
  afterRelief: number;
  cessLines: Array<{ ruleId: number; amount: number }>;
  yearlyTax: number;
  taxPaid: number;
  monthsLeft: number;
  monthlyTdsCents: number;
  warnings: string[];
}

/** PHP round($x, 2) as cents: pre-round x·100 to 15 significant digits, then half away from zero. */
export function phpRoundCents(x: number): number {
  if (!Number.isFinite(x) || x === 0) return 0;
  const pre = Number((x * 100).toPrecision(15));
  return pre >= 0 ? Math.floor(pre + 0.5) : -Math.floor(-pre + 0.5);
}

/** UPPER_LIMIT text as a number, or null for '&infin;' / blank / anything not numeric. */
export function numericUpper(u: string | null | undefined): number | null {
  const t = String(u ?? '').trim();
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** CI: PHP < 8.1 DateTime::diff of the FY end and the 1st of the month, both shifted to UTC from Asia/Kolkata. */
export function ciMonthsLeft(fyEnd: string, year: number, month: number, tzMinutes = 330): number {
  const toUtc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 0, 0) - tzMinutes * 60000);
  const [ey, em, ed] = fyEnd.split('-').map(Number);
  let a = toUtc(year, month, 1);
  let b = toUtc(ey, em, ed);
  if (a > b) [a, b] = [b, a];
  let y = b.getUTCFullYear() - a.getUTCFullYear();
  let m = b.getUTCMonth() - a.getUTCMonth();
  let d = b.getUTCDate() - a.getUTCDate();
  let h = b.getUTCHours() - a.getUTCHours();
  let i = b.getUTCMinutes() - a.getUTCMinutes();
  if (i < 0) { i += 60; h--; }
  if (h < 0) { h += 24; d--; }
  while (m < 0) { m += 12; y--; }
  let by = a.getUTCFullYear();
  let bm = a.getUTCMonth() + 1;
  while (d < 0) { d += daysIn(by, bm); m--; bm--; if (bm < 1) { bm += 12; by--; } }
  while (m < 0) { m += 12; y--; }
  return y * 12 + m + d / 30;
}

/** Whole payroll months from this month to the FY end, this month included (April → 12 … March → 1). */
export function wholeMonthsLeft(fyEnd: string, year: number, month: number): number {
  const [ey, em] = fyEnd.split('-').map(Number);
  return Math.max(1, ey * 12 + em - (year * 12 + month) + 1);
}

/**
 * CI getTotalNonTaxableAmountByEmp: the yearly amount of the "Deduct from Taxable Income" components (live:
 * Professional Tax — 300 in February + 11 × 200), banded on the monthly salary. `rules`: the components' rules for
 * the employee's gender, in component order then LOWER_LIMIT asc, MONTH desc, id asc.
 */
export function nonTaxableYearly(rules: TaxRule[], dep: number, codes: TdsCodes, mode: TdsMode): number {
  const band = (r: TaxRule) => {
    const up = numericUpper(r.upper);
    return (mode === 'ci' ? dep <= (up ?? 0) : up !== null && dep <= up) && dep >= r.lower || (r.open && dep >= r.lower);
  };
  if (mode === 'ci') {
    let total = 0;
    let value: number | string | null = null;
    let monthCount = 0;
    let monthly = 0;
    let component: number | null | undefined;
    for (const r of rules) {
      if (r.component !== component) { component = r.component; monthCount = 0; monthly = 0; }
      const V = phpFloat(r.values);
      if (r.factor === codes.CFP) {
        if (!value && band(r)) { total += dep * (V / 100); value = dep * (V / 100); } else continue;
      } else if (r.factor === codes.CFFAC) {
        if (!phpFloat(String(value ?? '')) && band(r)) { total += V; value = r.values; } else continue;
      } else if (r.factor === codes.CFCONR) {
        if (band(r)) { if (r.month) { monthCount++; total += V; } else monthly = V; }
      }
      if (monthCount && monthly) total += monthly * (12 - monthCount);
    }
    return total;
  }
  let total = 0;
  const components = [...new Set(rules.map((r) => r.component))];
  for (const c of components) {
    const own = rules.filter((r) => r.component === c && band(r));
    const conditional = own.filter((r) => r.factor === codes.CFCONR);
    if (conditional.length) {
      for (let m = 1; m <= 12; m++) {
        const r = conditional.find((x) => x.month === m) ?? conditional.find((x) => !x.month);
        if (r) total += phpFloat(r.values);
      }
      continue;
    }
    const once = own.find((r) => r.factor === codes.CFP || r.factor === codes.CFFAC);
    if (once) total += once.factor === codes.CFP ? dep * (phpFloat(once.values) / 100) : phpFloat(once.values);
  }
  return total;
}

/** Fixed mode: one cess rule per component — the employee's regime first, else a regime-less / old-regime one. */
function pickCessRules(rules: TaxRule[], regime: Regime, tax: number, codes: TdsCodes): TaxRule[] {
  const out: TaxRule[] = [];
  const inBand = (r: TaxRule) => {
    const up = numericUpper(r.upper);
    return tax >= r.lower && ((up !== null && tax <= up) || r.open);
  };
  for (const c of [...new Set(rules.map((r) => r.component))]) {
    const own = rules.filter((r) => r.component === c && (r.factor === codes.CFP || r.factor === codes.CFFAC));
    const mine = own.filter((r) => r.newRegime === (regime === 'new'));
    const pool = mine.length ? mine : own.filter((r) => !r.newRegime);
    const r = pool.find(inBand);
    if (r) out.push(r);
  }
  return out;
}

export function computeTds(i: TdsInputs): TdsResult {
  const ci = i.mode === 'ci';
  const warnings: string[] = [];
  let income = i.annualIncome - i.lopYtd - i.nonTaxable - i.flatDeductions.reduce((s, v) => s + phpFloat(v), 0);
  if (i.regime === 'old') income -= i.investments;
  const monthsLeft = i.monthsLeftOverride ?? (ci ? ciMonthsLeft(i.fyEnd, i.year, i.month) : wholeMonthsLeft(i.fyEnd, i.year, i.month));
  const empty: TdsResult = {
    taxableIncome: income, slabLines: [], slabTax: 0, rebate: 0, marginalReliefApplied: false, afterRelief: 0, cessLines: [], yearlyTax: 0,
    taxPaid: i.taxPaid, monthsLeft, monthlyTdsCents: 0, warnings,
  };
  if (!i.slabs.length) {
    warnings.push('no-slabs');
    return empty;
  }

  // Slabs, LOWER_LIMIT ascending (CI 2.1.4's order_by('LOWER_LIMIT,MONTH','desc') is "LOWER_LIMIT, MONTH desc").
  const slabLines: TdsResult['slabLines'] = [];
  let slabTax = 0;
  let prev = 0;
  let prevUpper = 0;
  for (const r of i.slabs) {
    const rate = phpFloat(r.values);
    let taxed = 0;
    if (ci) {
      const up = phpFloat(r.upper); // '&infin;' reads as 0
      if (income !== 0 && prev < up && income > up && !r.open) { taxed = up - prev; prev = up; }
      else if (income !== 0 && income > r.lower) { taxed = prev > r.lower ? income - prev : income - r.lower; prev = income; }
    } else {
      const up = numericUpper(r.upper);
      const top = r.open || up === null ? income : Math.min(income, up);
      taxed = Math.max(0, top - prevUpper);
      if (!r.open && up !== null) prevUpper = up;
    }
    const tax = taxed * (rate / 100);
    slabTax += tax;
    slabLines.push({ ruleId: r.id, taxed, rate, tax });
  }

  // Rebate (87A): rows banding the income; CI keeps the last of LOWER_LIMIT desc (the lowest band).
  const upperOf = (r: TaxRule) => numericUpper(r.upper) ?? (ci ? 0 : r.open ? Infinity : -Infinity);
  const rebateRows = i.rebates.filter((r) => r.lower <= income && upperOf(r) >= income).sort((a, b) => b.lower - a.lower || a.id - b.id);
  const rebate = rebateRows.length ? phpFloat(rebateRows[rebateRows.length - 1].values) : 0;
  let tax = slabTax - rebate;
  if (tax < 0) tax = 0;

  // Marginal relief (new regime): the tax may not exceed the income above the threshold.
  let marginalReliefApplied = false;
  if (i.regime === 'new') {
    const mr = i.marginalRelief.filter((r) => r.lower <= income && upperOf(r) >= income).sort((a, b) => b.lower - a.lower || a.id - b.id)[0];
    if (mr) {
      const capped = Math.min(tax, Math.max(0, income - phpFloat(mr.values)));
      marginalReliefApplied = capped < tax;
      tax = capped;
    }
  }

  // Cess and any other rule depending on the tax.
  const cessLines: TdsResult['cessLines'] = [];
  let cess = 0;
  if (ci) {
    if (i.taxDependents.length > 1) warnings.push('cess-rules-added');
    for (const r of i.taxDependents) {
      const V = phpFloat(r.values);
      const inBand = (tax >= r.lower && tax <= phpFloat(r.upper)) || (r.open && income >= r.lower);
      if (!inBand) continue;
      const amount = r.factor === i.codes.CFP ? tax * (V / 100) : r.factor === i.codes.CFFAC ? V : 0;
      if (amount) { cess += amount; cessLines.push({ ruleId: r.id, amount }); }
    }
  } else {
    for (const r of pickCessRules(i.taxDependents, i.regime, tax, i.codes)) {
      const V = phpFloat(r.values);
      const amount = r.factor === i.codes.CFP ? tax * (V / 100) : V;
      cess += amount;
      cessLines.push({ ruleId: r.id, amount });
    }
  }
  const yearlyTax = tax + cess;
  const paid = i.considerTaxPaid ? i.taxPaid : 0;
  const payable = Math.max(0, yearlyTax - paid);
  if (income < 0) warnings.push('income-negative');
  return {
    taxableIncome: income, slabLines, slabTax, rebate, marginalReliefApplied, afterRelief: tax, cessLines, yearlyTax, taxPaid: paid, monthsLeft,
    monthlyTdsCents: monthsLeft > 0 ? phpRoundCents(payable / monthsLeft) : 0, warnings,
  };
}

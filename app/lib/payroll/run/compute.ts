import { phpFloat, storedCents } from '../annexure/ruleMath';

/**
 * CI emp_sal_component_mst::generateSalaryDetails — one employee's payslip for a month, a pure function of the
 * inputs (loaded by ./context.ts, written by ./writer.ts). Order and formulas as CI, which decide the totals and the
 * value each rule sees:
 *   1. the current annexure's monthly rows are copied; the header starts at the annexure's total;
 *   2. Incentives / Arrears, Loans Disbursed, Commission, Advance Salary (+);
 *   3. Outdoor Allowance (+) for the eligible days of the month, by its benefit rule;
 *   4. Advance Repayment, Loans Installment (−);
 *   5. LOP = LOP days × (monthly total / days in the month) (−);
 *   6. the brand's rule-driven deductions and contributions (Professional Tax …) (−);
 *   7. Income Tax (TDS, ../tds/compute.ts) (−), then the employee-absent-all-month carry.
 * Every amount is a double in CI's operation order, stored as the cents MySQL kept (ruleMath.storedCents); the net
 * pay is the annexure total plus the signed stored rows.
 *
 * Behaviour changes: a copied deduction (Mediclaim) is the deduction — subtracted once, no duplicate row (CI
 * subtracted it from an unrelated temp payslip and added a duplicate that it subtracted, counting it twice in the
 * year's deductions); no rows without a component (CI wrote three 0.00 rows for its missing commission / leave
 * encashment / notice masters); every value is the employee's own (CI leaked the previous employee's value, gender
 * and earned amount into the next one in a batch run); the first rule whose band holds the value wins; an employee
 * absent the whole month is paid 0, not a negative amount, and only the shortfall is carried to the next month (CI
 * paid the negative amount and carried the same deductions again).
 */
export type Cents = number;
export type LineType = 'addition' | 'deduction' | 'contribution';

export interface RunCodes {
  SFPLUS: number;
  SFMINUS: number;
  CFP: number;
  CFFAC: number;
  CFCONR: number;
  CFSLRT: number;
  SCLOP: number;
  PCINCARR: number;
  PCLOADV: number;
  SADVSAL: number;
  SADVREP: number;
  SLOAINST: number;
  SCPTX: number;
  SCINTX: number;
  SCODA: number;
  /** Commission's master (PCCOMMS) — missing in the live data. */
  PCCOMMS: number | null;
}

export interface RunRule {
  id: number;
  component: number;
  factor: number;
  /** DEPENDENT_ON_COMP as a master id; null when blank. */
  dependent: number | null;
  lower: number;
  /** null: '&infin;' or not numeric. */
  upper: number | null;
  open: boolean;
  /** phpFloat(VALUES) */
  value: number;
  sign: number;
  gender: number | null;
  /** 0 = every month. */
  month: number;
  /** IS_DISABLE = 1: the rule of disabled employees. */
  forDisabled: boolean;
}

export interface RuleComponent {
  component: number;
  type: LineType;
}

export interface RunSetup {
  codes: RunCodes;
  month: number;
  year: number;
  days: number;
  /** SSASITC = Tax Deduction at Source: an Income Tax row on every payslip. */
  tds: boolean;
  /** The brand pays Outdoor Allowance (SCODA enabled and visible in salary). */
  oda: boolean;
  /** The brand's rule-driven deductions / contributions (CI getComponentSettingExceptAdditions), in sequence order. */
  ruleComponents: RuleComponent[];
  /** Benefit rules of the brand's FY and country (live, + and − signs), LOWER_LIMIT asc, MONTH desc, id asc. */
  rules: RunRule[];
  /** Component → salary_breakup column (salary_breakup_cols). */
  columns: Map<number, string>;
  /** Component → its type in the brand's settings (lowest SC_ID); Basic has none (an earning). */
  types: Map<number, LineType>;
}

export interface CopiedLine {
  component: number;
  cents: Cents;
}

export interface EmployeeRun {
  empId: number;
  gender: number | null;
  isDisabled: boolean;
  annexure: { id: number; actualCents: Cents; earnedCents: Cents; lines: CopiedLine[] };
  lopDays: number;
  inputs: { incentive: Cents; loanDisbursed: Cents; commission: Cents; advance: Cents; advanceRepayment: Cents; loanInstalments: Cents };
  /** Eligible Outdoor Allowance days of the month (0: no record). */
  odaDays: number;
  /** The FY salary_breakup row before this payslip (cents per column). */
  breakup: Record<string, Cents>;
}

export interface PayslipLine {
  component: number;
  cents: Cents;
  source: 'copied' | 'run';
  /** Run rows: LOP days on the LOP row. */
  desc?: string;
}

export interface PayslipDraft {
  actualCents: Cents;
  lines: PayslipLine[];
  /** Net pay before the tax. */
  earnedCents: Cents;
  lopCents: Cents;
  /** Professional Tax of the month (when computed), for the PT breakup. */
  ptCents: Cents | null;
  absentWholeMonth: boolean;
  /** The snapshot the rules read: the breakup plus the copied rows. */
  snapshot: Record<string, Cents>;
  warnings: string[];
}

export interface PayslipResult extends PayslipDraft {
  taxCents: Cents | null;
  /** Negative cents carried to next month ("Pending Deductions"), or null. */
  arrearCents: Cents | null;
}

/** CI band test on the dependent value: lower ≤ v ≤ upper, or lower ≤ v on an open rule ('&infin;' never holds). */
export function inBand(v: number, r: Pick<RunRule, 'lower' | 'upper' | 'open'>): boolean {
  return (r.upper !== null && v >= r.lower && v <= r.upper) || (r.open && v >= r.lower);
}

/** Rule types the run fixes, whatever the settings say. */
export function runLineType(component: number | null, setup: Pick<RunSetup, 'codes' | 'types'>): LineType {
  const c = setup.codes;
  if (component === null) return 'addition';
  if ([c.PCINCARR, c.PCLOADV, c.SADVSAL, c.SCODA, c.PCCOMMS].includes(component)) return 'addition';
  if ([c.SADVREP, c.SLOAINST, c.SCLOP, c.SCINTX].includes(component)) return 'deduction';
  return setup.types.get(component) ?? 'addition';
}

/**
 * What a payslip adds to the FY salary_breakup row, from its rows — used by the run (+) and by the payslip delete (−),
 * so a delete reverts exactly what the generation added. `copy`: the copied annexure rows (applied before the
 * snapshot the rules read): earnings to their columns, CUM_GROSS_EARNINGS += earnings − deductions − contributions.
 * `run`: the run's rows: their columns (LOP, Professional Tax, Income Tax …), ANNUAL_SALARY += incentives and
 * commission, CUM_GROSS_* += the run's earnings / deductions / contributions (CI's order and asymmetry).
 */
export function breakupDeltas(lines: Array<{ component: number | null; cents: Cents; source: 'copied' | 'run' }>, setup: Pick<RunSetup, 'codes' | 'types' | 'columns'>) {
  const copy: Record<string, Cents> = {};
  const run: Record<string, Cents> = {};
  const add = (d: Record<string, Cents>, col: string | undefined, cents: Cents) => {
    if (col && cents) d[col] = (d[col] ?? 0) + cents;
  };
  let gross = 0;
  let ded = 0;
  let contrib = 0;
  let runAdd = 0;
  let runDed = 0;
  let runContrib = 0;
  for (const l of lines) {
    if (l.component === null || !l.cents) continue;
    if (l.source === 'copied') {
      const t = setup.types.get(l.component) ?? 'addition';
      if (t === 'deduction') ded += l.cents;
      else if (t === 'contribution') contrib += l.cents;
      else {
        gross += l.cents;
        add(copy, setup.columns.get(l.component), l.cents);
      }
      continue;
    }
    const t = runLineType(l.component, setup);
    add(run, setup.columns.get(l.component), l.cents);
    if (l.component === setup.codes.PCINCARR || l.component === setup.codes.PCCOMMS) add(run, 'ANNUAL_SALARY', l.cents);
    if (t === 'deduction') runDed += l.cents;
    else if (t === 'contribution') runContrib += l.cents;
    else runAdd += l.cents;
  }
  add(copy, 'CUM_GROSS_EARNINGS', gross - contrib - ded);
  add(copy, 'CUM_GROSS_DEDUCTIONS', ded);
  add(copy, 'CUM_GROSS_CONTRIBUTIONS', contrib);
  add(run, 'CUM_GROSS_EARNINGS', runAdd);
  add(run, 'CUM_GROSS_DEDUCTIONS', runDed);
  add(run, 'CUM_GROSS_CONTRIBUTIONS', runContrib);
  return { copy, run };
}

const plus = (a: Record<string, Cents>, b: Record<string, Cents>) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
};

/** A rule's dependent value: the snapshot column of the dependent component, or the earned amount when blank. */
function dependentValue(r: RunRule, setup: RunSetup, snapshot: Record<string, Cents>, earned: Cents, warnings: string[]): number {
  if (r.dependent === null) return earned / 100;
  const col = setup.columns.get(r.dependent);
  if (!col) {
    warnings.push(`Benefit rule ${r.id} depends on a component without a salary breakup column; 0 used.`);
    return 0;
  }
  return (snapshot[col] ?? 0) / 100;
}

/** The rules of a component for this employee, in CI's order (LOWER_LIMIT asc, MONTH desc, id asc). */
function rulesFor(setup: RunSetup, e: EmployeeRun, component: number, sign: number, disability: boolean): RunRule[] {
  const own = setup.rules.filter((r) => r.component === component && r.sign === sign && (r.gender === null || r.gender === 0 || r.gender === e.gender));
  if (!disability) return own;
  // CI: the rules for the employee's disability flag, else the general ones.
  const mine = own.filter((r) => r.forDisabled === e.isDisabled);
  return mine.length ? mine : own.filter((r) => !r.forDisabled);
}

/** One rule-driven amount (a raw double), or null when no rule applies. */
function evaluate(rules: RunRule[], setup: RunSetup, kind: 'addition' | 'deduction', depOf: (r: RunRule) => number, odaDays: number): { value: number; ruleId: number } | null {
  const c = setup.codes;
  const m = setup.month;
  const slabs = rules.filter((r) => r.factor === c.CFSLRT);
  if (slabs.length) {
    // Slab rate (no live rule outside income tax): the part of the value inside each slab × its rate, a year → a month.
    let annual = 0;
    for (const r of slabs) {
      const dep = depOf(r);
      const top = r.open || r.upper === null ? dep : Math.min(dep, r.upper);
      if (top > r.lower) annual += (top - r.lower) * (r.value / 100);
    }
    return { value: annual / 12, ruleId: slabs[0].id };
  }
  for (const r of rules) {
    const dep = depOf(r);
    if (!inBand(dep, r)) continue;
    if (r.factor === c.CFP) return { value: (dep / 12) * (r.value / 100), ruleId: r.id };
    if (r.factor === c.CFFAC) {
      // Additions: the month's amount, Outdoor Allowance pro-rated by its eligible days; deductions: a yearly figure.
      if (kind === 'addition') return { value: odaDays ? odaDays * (r.value / setup.days) : r.value, ruleId: r.id };
      return { value: r.value / 12, ruleId: r.id };
    }
    if (r.factor === c.CFCONR) {
      if (r.month === 0 || r.month === m) return { value: r.value, ruleId: r.id };
      continue;
    }
  }
  return null;
}

export function computePayslip(setup: RunSetup, e: EmployeeRun): PayslipDraft {
  const c = setup.codes;
  const warnings: string[] = [];
  const A = e.annexure.actualCents;
  let E = e.annexure.earnedCents;
  const lines: PayslipLine[] = e.annexure.lines.map((l) => ({ component: l.component, cents: l.cents, source: 'copied' }));

  // 1. Copied rows: contributions and deductions (Mediclaim) come off the net pay.
  for (const l of e.annexure.lines) {
    const t = setup.types.get(l.component) ?? 'addition';
    if (t !== 'addition') E -= l.cents;
  }
  const snapshot = plus(e.breakup, breakupDeltas(lines, setup).copy);

  const run = (component: number, cents: Cents, desc?: string) => {
    lines.push({ component, cents, source: 'run', ...(desc !== undefined ? { desc } : {}) });
    E += runLineType(component, setup) === 'addition' ? cents : -cents;
  };

  // 2. Inputs paid with the salary (CI writes the rows even at 0.00; they are printed on the payslip).
  run(c.PCINCARR, e.inputs.incentive);
  run(c.PCLOADV, e.inputs.loanDisbursed);
  if (c.PCCOMMS !== null && e.inputs.commission) run(c.PCCOMMS, e.inputs.commission);
  run(c.SADVSAL, e.inputs.advance);

  // 3. Outdoor Allowance: only with an eligible record in the month and a rule in band.
  if (setup.oda && e.odaDays > 0) {
    const rules = rulesFor(setup, e, c.SCODA, c.SFPLUS, false);
    const hit = evaluate(rules, setup, 'addition', (r) => dependentValue(r, setup, snapshot, E, warnings), Math.min(e.odaDays, setup.days));
    if (hit) run(c.SCODA, storedCents(hit.value));
  }

  // 4. Recoveries.
  run(c.SADVREP, e.inputs.advanceRepayment);
  run(c.SLOAINST, e.inputs.loanInstalments);

  // 5. Loss of pay on the month's total (not Basic), by calendar days.
  const lop = storedCents(e.lopDays * (A / 100 / setup.days));
  run(c.SCLOP, lop, String(e.lopDays));

  // 6. Rule-driven deductions and contributions (Professional Tax …). Income tax, LOP, advances and loans are above.
  let ptCents: Cents | null = null;
  // A component the annexure carries (Mediclaim) is that row — never computed a second time.
  const done = new Set([c.SCINTX, c.SCLOP, c.SADVREP, c.SLOAINST, c.SCODA, c.PCINCARR, c.PCLOADV, c.SADVSAL, ...e.annexure.lines.map((l) => l.component)]);
  for (const rc of setup.ruleComponents) {
    if (done.has(rc.component)) continue;
    done.add(rc.component);
    const rules = rulesFor(setup, e, rc.component, c.SFMINUS, true);
    if (!rules.length) continue; // a copied row (Mediclaim) was already deducted; nothing else to add
    const hit = evaluate(rules, setup, 'deduction', (r) => dependentValue(r, setup, snapshot, E, warnings), 0);
    const cents = hit ? storedCents(hit.value) : 0;
    lines.push({ component: rc.component, cents, source: 'run' });
    E -= cents;
    if (rc.component === c.SCPTX) ptCents = cents;
  }

  return { actualCents: A, lines, earnedCents: E, lopCents: lop, ptCents, absentWholeMonth: e.lopDays === setup.days, snapshot, warnings };
}

/** Adds the month's income tax and settles an employee absent the whole month. */
export function finishPayslip(setup: RunSetup, draft: PayslipDraft, taxCents: Cents | null): PayslipResult {
  const lines = [...draft.lines];
  let E = draft.earnedCents;
  if (setup.tds) {
    const tax = taxCents ?? 0;
    lines.push({ component: setup.codes.SCINTX, cents: tax, source: 'run' });
    E -= tax;
  }
  let arrearCents: Cents | null = null;
  if (draft.absentWholeMonth && E < 0) {
    // CI paid the negative amount and carried the deductions again; NEW pays 0 and carries the shortfall only.
    arrearCents = E;
    E = 0;
  }
  return { ...draft, lines, earnedCents: E, taxCents: setup.tds ? (taxCents ?? 0) : null, arrearCents };
}

/** Rule rows → RunRule (shared by the loader and the tests). */
export function toRunRule(r: { id: number; component: number; factor: number; dependent: string | null; lower: string | number; upper: string | null; open: number; values: string | null; sign: number; gender: number | null; month: number | null; isDisable: number | null }): RunRule {
  const dep = String(r.dependent ?? '').trim();
  const up = String(r.upper ?? '').trim();
  return {
    id: Number(r.id), component: Number(r.component), factor: Number(r.factor), dependent: /^\d+$/.test(dep) ? Number(dep) : null,
    lower: Number(r.lower), upper: /^-?\d+(\.\d+)?$/.test(up) ? Number(up) : null, open: Number(r.open) === 1, value: phpFloat(r.values),
    sign: Number(r.sign), gender: r.gender === null ? null : Number(r.gender), month: Number(r.month ?? 0), forDisabled: Number(r.isDisable ?? 0) === 1,
  };
}

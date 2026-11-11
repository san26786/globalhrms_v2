import { phpFloat, storedCents } from './ruleMath';

/**
 * CI emp_sal_component_mst::generateAnnexureDetails / updateSalaryCompForAnnexure — the amounts of one employee's
 * annexure, a pure function of the inputs (loaded by ./generate.ts). For every component of the brand's annexure
 * (Salary Component settings visible in the annexure, in sequence order) the benefit rule whose band holds the
 * yearly gross gives a yearly amount and one of the brand's pay frequency:
 *   - Basic = gross × SSAMTPLBP %;
 *   - Percentage (CFP) of a component already computed (its stored yearly amount; CTC = the gross);
 *   - Fixed amount (CFFAC): the rule value a year, / 12 a period;
 *   - Constant components (PCCTC, CFP): a share of what the gross leaves after the components so far;
 *   - Gratuity (SCGR): basic daily × 15 × completed years, when asked for;
 *   - anything else (conditional, slab rules), no rule, or a zero value: 0.
 * Header totals are Basic plus every component of a "+" rule. Amounts are the cents CI stored (ruleMath.ts).
 */
export type Frequency = 'PFYLY' | 'PFMLY' | 'PFWLY' | 'PFDLY';

export interface AnnexureSetting {
  component: number;
  calcType: number | null;
}

export interface AnnexureRule {
  id: number;
  component: number;
  factor: number;
  dependent: string;
  values: string;
  sign: number;
  lower: number;
  upper: string;
  open: number;
}

export interface AnnexureCodes {
  SCBS: number;
  SCCC: number;
  SCGR: number;
  PCCTC: number;
  SFPLUS: number;
  SFMINUS: number;
  CFP: number;
  CFFAC: number;
}

export interface AnnexureInputs {
  gross: number;
  frequency: Frequency;
  /** OASAMPG / OASAWPG: the share of the gross paid monthly / weekly (%). */
  monthlyPercent: number;
  weeklyPercent: number;
  /** SSAMTPLBP: Basic as a share of the salary (%). */
  basicPercent: number;
  /** The annexure's components (visible in the annexure), in sequence order. */
  settings: AnnexureSetting[];
  /** Benefit rules of the brand and financial year. */
  rules: AnnexureRule[];
  /** Per component: how many of the brand's settings rows have a calc type other than Constant (CI's Constant base join). */
  nonConstantRows: Map<number, number>;
  codes: AnnexureCodes;
  gratuity: { calculate: boolean; basicDaily: number | null; joined: string | null; today: string };
  /** Server's current year: CI's daily / weekly divisor used it, not the annexure's. */
  currentYear: number;
}

export interface AnnexureLine {
  component: number;
  yearly: number;
  period: number;
  /** Counted in the header totals ("+" rule, and Basic). */
  plus: boolean;
}

export interface AnnexureResult {
  lines: AnnexureLine[];
  yearlyTotal: number;
  periodTotal: number;
  /** The period salary (CI's monthly salary) and the gross, in cents, for the salary breakup. */
  periodSalary: number;
  gross: number;
}

export class AnnexureError extends Error {}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** ISO weeks of the year (53 when 28 December falls in week 53). */
const isoWeeks = (y: number) => {
  const d = new Date(Date.UTC(y, 11, 28));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
};

/** CI: the salary of the selected frequency (no rounding). */
export function periodSalary(gross: number, i: Pick<AnnexureInputs, 'frequency' | 'monthlyPercent' | 'weeklyPercent' | 'currentYear'>): number {
  switch (i.frequency) {
    case 'PFYLY':
      return gross;
    case 'PFDLY':
      return gross / (isLeap(i.currentYear) ? 366 : 365);
    case 'PFWLY':
      return ((gross / isoWeeks(i.currentYear)) * i.weeklyPercent) / 100;
    default:
      return ((gross / 12) * i.monthlyPercent) / 100;
  }
}

/** The rule of a component: the band holding the yearly gross, highest lower limit first. */
export function selectRule(rules: AnnexureRule[], component: number, gross: number, codes: AnnexureCodes): AnnexureRule | null {
  const upper = (u: string) => (/^\s*-?\d+(\.\d+)?\s*$/.test(u) ? Number(u) : null);
  return (
    rules
      .filter((r) => r.component === component && (r.sign === codes.SFPLUS || r.sign === codes.SFMINUS))
      .filter((r) => {
        const u = upper(r.upper);
        return (u !== null && gross >= r.lower && gross <= u) || (r.lower <= gross && r.open === 1);
      })
      .sort((a, b) => b.lower - a.lower || a.id - b.id)[0] ?? null
  );
}

const DAY = 86400000;

export function computeAnnexure(i: AnnexureInputs): AnnexureResult {
  const G = i.gross;
  const F = periodSalary(G, i);
  const { codes } = i;
  const lines: AnnexureLine[] = [];
  const stored = new Map<number, number>(); // component → yearly cents (first row wins, as CI's lookup)
  const add = (component: number, yearly: number, period: number, plus: boolean) => {
    lines.push({ component, yearly, period, plus });
    if (!stored.has(component)) stored.set(component, yearly);
  };

  add(codes.SCBS, storedCents((G * i.basicPercent) / 100), storedCents((F * i.basicPercent) / 100), true);
  const basic = lines[0].yearly;

  for (const s of i.settings) {
    const rule = selectRule(i.rules, s.component, G, codes);
    if (!rule) {
      add(s.component, 0, 0, false);
      continue;
    }
    const plus = rule.sign === codes.SFPLUS;
    const V = phpFloat(rule.values);
    const dep = Number(rule.dependent);
    const D = rule.dependent.trim() !== '' && dep === codes.SCCC ? G : (stored.get(dep) ?? 0) / 100;
    let A = 0;
    let P = 0;
    if (s.component === codes.SCGR) {
      if (i.gratuity.calculate) {
        const joined = i.gratuity.joined;
        if (!joined || joined.startsWith('0000')) throw new AnnexureError('Date of Joining not available for this employee.');
        const years = Math.floor((Date.parse(`${i.gratuity.today}T00:00:00Z`) - Date.parse(`${joined}T00:00:00Z`)) / (365 * DAY));
        if (years < 1) throw new AnnexureError('Employee has not completed 1 year of service. Gratuity is not applicable.');
        A = (i.gratuity.basicDaily ?? 0) * 15 * years;
        P = A;
      }
    } else if (V !== 0) {
      if (s.calcType === codes.PCCTC) {
        if (rule.factor === codes.CFP) {
          // What the gross leaves after the rows so far (CI: their sum joined to the brand's non-constant settings rows, plus Basic).
          let sum = 0;
          let joined = false;
          for (const l of lines) {
            const n = i.nonConstantRows.get(l.component) ?? 0;
            if (n) joined = true;
            sum += l.yearly * n;
          }
          const T = joined ? (sum + basic) / 100 : 0;
          A = (G - T) * (V / 100);
          P = A / 12;
        }
      } else if (rule.factor === codes.CFP) {
        A = D * (V / 100);
        P = (D / 12) * (V / 100);
      } else if (rule.factor === codes.CFFAC) {
        A = V;
        P = V / 12;
      }
    }
    add(s.component, storedCents(A), storedCents(P), plus);
  }

  const total = (pick: (l: AnnexureLine) => number) => lines.filter((l) => l.plus).reduce((s, l) => s + pick(l), 0);
  return { lines, yearlyTotal: total((l) => l.yearly), periodTotal: total((l) => l.period), periodSalary: storedCents(F), gross: storedCents(G) };
}

import * as XLSX from 'xlsx';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { BusinessRuleError, ForbiddenError, ValidationError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { centsText, toCents } from '../annexure/ruleMath';
import { fyMonths, resolveFy } from '../reports/periods';
import { hraExemption } from './declarationService';
import { brandCountry, matchingRule, type DeclarationRule, type RuleScope } from './rules';
import { numericUpper } from '../tds/compute';
import { employeeTaxFigures, loadTaxYear } from './taxSummary';

/**
 * CI emp_investment_declarations::exportTaxBreakup (Salary Breakup → "Generate Tax Breakup"): "Tax Breakup
 * Report.xlsx" — per salary breakup row of a financial year: the salary figures, each declaration section (declared,
 * maximum and actual benefit), the taxable income before and after the declarations, CI's 5 / 20 / 30 % slab split,
 * the year's payable tax, the income tax each month's payslip deducted and the balance. Two header rows as CI's.
 *
 * Behaviour changes: admins with the Salary Breakup grant only (CI's POST was open to anyone); the year is required
 * and must be one of the brand's; the taxable income and payable tax are payroll's TDS figures (taxSummary.ts: the
 * employee's regime — CI's "Balance Taxable amount" always took the investments off); NPS, donations and 80DD rows
 * whose IS_DELETED is empty count (CI's export required 0 and so never showed them, though the declaration counted
 * them); the "Max" columns are filled for a declared section only and from its own rule (CI carried the previous
 * employee's maximum over when no rule matched); the 80D columns are filled — children / self (Child) and parents
 * (Parent): age groups, the rows' maxima and amounts, and the actual 80D benefit (CI left them empty); the 80E start
 * year is the year's name (CI wrote its id); the month columns follow the year's months; only payslips count and
 * deleted rows are ignored. Kept from CI: the 5 / 20 / 30 % slab columns use CI's fixed limits (2.5 / 5 / 10 lakh).
 */
const MENU = 'employeeMngt/emp_sal_component_dtl/SalaryBreakUp';
const FILE = 'Tax Breakup Report.xlsx';

type Cell = XLSX.CellObject | null;
const num = (v: number | string | null | undefined): Cell => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? { t: 'n', v: n, z: '0.00' } : null;
};
const str = (v: string | null | undefined): Cell => (v === null || v === undefined || v === '' ? null : { t: 's', v });
const yesNo = (v: unknown) => (Number(v ?? 0) ? 'Yes' : 'No');

/** CI's "Max … Benefit": the rule's limit, or the declared amount under an open rule. */
const maxOf = (rule: DeclarationRule | null, declared: number): number | null => (!rule ? null : rule.open ? declared : (numericUpper(rule.upper) ?? 0));

interface Row extends Record<string, unknown> {
  slb: number;
  emp: number;
}

export async function taxBreakupWorkbook(subject: RequestSubject, rawFy: string | undefined): Promise<{ name: string; data: Buffer }> {
  if (subject.adminLevel === 0 || !(await menuPolicy(MENU).check(subject, 'list'))) throw new ForbiddenError();
  const brand = subject.oaBrandId ?? null;
  if (!brand) throw new BusinessRuleError('Select a brand first.');
  const id = Number(rawFy);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Validation failed.', { fy: ['The Financial Year field is required.'] });
  const fy = await resolveFy(brand, id);
  const months = fyMonths(fy.start, fy.end);
  const [setup, country, incentiveType, medChild] = await Promise.all([loadTaxYear(brand, fy.id), brandCountry(brand), getMasterId('MACINCEN'), getMasterId('MEDCHI')]);
  const scope: RuleScope = { brand, country, fy: fy.id };

  const people = await prisma.$queryRaw<Row[]>`
    SELECT t."SLB_ID" AS slb, t."EMP_ID" AS emp, em."EMP_NBR" AS code,
      btrim(COALESCE(em."EMP_NAME", '') || ' ' || COALESCE(em."EMPLST_NM", '')) AS name,
      (SELECT to_char(j."DATE_OF_JOINING", 'FMDD-Mon-YYYY') FROM job_mst j WHERE j."EMP_ID" = t."EMP_ID" AND j."IS_DELETED" = 0 ORDER BY j."JOB_ID" LIMIT 1) AS doj,
      t."CTC"::text AS ctc, t."ANNUAL_SALARY"::text AS annual, t."PROFESSIONAL_TAX"::text AS pt, t."MEDICAL_ALLOWANCE"::text AS medical,
      t."TELEPHONE_ALLOWANCE"::text AS telephone, t."CONVEYANCE_ALLOWANCE"::text AS conveyance,
      (SELECT sum(i."AMOUNT")::text FROM incentive i
        WHERE i."IS_DELETED" = 0 AND btrim(i."EMP_ID") = t."EMP_ID"::text AND btrim(i."INCENTIVE") = ${String(incentiveType ?? -1)}
          AND btrim(i."DATE") ~ '^(0?[1-9]|1[0-2])/[0-9]{4}$'
          AND make_date(split_part(btrim(i."DATE"), '/', 2)::int, split_part(btrim(i."DATE"), '/', 1)::int, 1) BETWEEN ${fy.start}::date AND ${fy.end}::date) AS bonus,
      (SELECT h."ID" FROM investment_mst_declaration h WHERE h."EMP_ID" = t."EMP_ID" AND h."FY_ID" = ${fy.id} AND h."IS_DELETED" = 0 ORDER BY h."ID" LIMIT 1) AS decl
    FROM salary_breakup t JOIN emp_mst em ON em."EMP_ID" = t."EMP_ID" AND em."IS_DELETED" = 0
    WHERE t."YEAR" = ${fy.id} AND t."IS_DELETED" = 0 AND t."BASIC" > 0 AND em."OA_BRAND_ID" = ${brand}
    ORDER BY t."SLB_ID"`;

  const taxRows = await prisma.$queryRaw<Array<{ emp: number; month: string; tax: string | null }>>`
    SELECT h."EMP_ID" AS emp, to_char(make_date(btrim(h."YEAR")::int, btrim(h."MONTH")::int, 1), 'YYYY-MM') AS month, sum(d."ACTUAL_AMOUNT")::text AS tax
    FROM emp_basic_sal_mst h JOIN emp_basic_sal_dtl d ON d."SAL_MST_ID" = h."EMP_SAL_ID" AND d."IS_DELETED" = 0
      AND d."SAL_COMP_ID" = (SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = 'SCINTX' ORDER BY im."MSTR_ID" LIMIT 1)
    WHERE h."IS_DELETED" = 0 AND h."EMP_ID" = ANY(${people.map((p) => Number(p.emp))}::int[])
      AND h."SAL_TYPE" = (SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = 'PRSTPS' ORDER BY im."MSTR_ID" LIMIT 1)
      AND btrim(h."YEAR") ~ '^[0-9]{4}$' AND btrim(h."MONTH") ~ '^(0?[1-9]|1[0-2])$'
      AND make_date(btrim(h."YEAR")::int, btrim(h."MONTH")::int, 1) BETWEEN ${fy.start}::date AND ${fy.end}::date
    GROUP BY h."EMP_ID", month`;
  const deducted = new Map<string, number>();
  for (const r of taxRows) deducted.set(`${r.emp}|${r.month}`, toCents(r.tax));

  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];
  const put = (c: number, r: number, cell: Cell) => {
    if (cell) ws[XLSX.utils.encode_cell({ c, r })] = cell;
  };
  const col = (letters: string) => XLSX.utils.decode_col(letters);
  /** A heading over two rows (merged), or over `sub` columns with their own second-row headings. */
  const head = (letters: string, title: string, sub?: string[]) => {
    const c = col(letters);
    put(c, 0, str(title));
    if (!sub) {
      merges.push({ s: { c, r: 0 }, e: { c, r: 1 } });
      return;
    }
    if (sub.length > 1) merges.push({ s: { c, r: 0 }, e: { c: c + sub.length - 1, r: 0 } });
    sub.forEach((s, i) => put(c + i, 1, str(s)));
  };
  head('A', 'Employee Id');
  head('B', 'Employee Name');
  head('C', 'Date of Joining');
  head('D', 'Annual CTC');
  head('E', 'Actual Current Year CTC');
  head('F', 'Bonus / Incentive');
  head('G', 'Professional Tax');
  head('H', 'Medical Allowance');
  head('I', 'Telephone Allowance');
  head('J', 'Conveyance Allowance');
  head('K', 'Taxable Income');
  head('L', 'HRA Benefit Calculation', ['City Type', 'Employee HRA Declared Amount', 'Rent Exemption Amount', 'HRA amount', 'City Basis HRA', 'HRA Benefit']);
  head('R', 'Home Loan Benefit Calculation', ['Completion Status', 'Self Occupied', 'In Same Council', 'Employee Paid Interest', 'Max Home Loan Benefit', 'Actual Home Loan Benefit']);
  head('X', 'Sec. 80CCD (1B) Benefit', ['Max 80CCD(1B) Benefit', 'Empolyee 80CCD (1B) Investment', 'Actual Sec. 80CCD (1B) Benefit']);
  head('AA', 'Sec 80D Benefit for Self, Spouse, Dependent Children', ['Age Group', 'Max 80D Benefit', 'Employee 80D Investment']);
  head('AD', 'Sec 80D Benefit for Parents', ['Age Group', 'Max 80D Benefit', 'Employee 80D Investment']);
  head('AG', 'Actual 80D Benefit');
  head('AH', 'Sec 80DD Benefit (Dependent Disability)', ['Dependant Disability Type', 'Max 80DD Benefit', 'Employee 80DD Investment', 'Actual 80DD Benefit']);
  head('AL', 'Sec 80E (Education Loan Interest for Self, Spose, Child or students for whom employee is a legal guardian)', [
    'Interest Payment Start Year', 'Employee 80E Investment', 'Actual 80E Benefit',
  ]);
  head('AO', 'Sec 80G (Donation)', ['Actual 80G Investment']);
  head('AP', 'Sec 80U (For Disable Employee)', ['Disability Type', 'Actual 80U Benefit']);
  head('AR', 'Sec 80C and 80CCC Deduction', ['Max Benefit under Sec 80C & 80CCC', 'Employee Declared Investment', 'Actual 80C & 80CCC Benefit']);
  head('AU', 'Total Tax Benefit');
  head('AV', 'Balance Taxable amount after Investment Deduction');
  head('AW', 'Amount under 5% Tax Slab');
  head('AX', 'Payable Tax under 5% Slab');
  head('AY', 'Amount under 20% Tax Slab');
  head('AZ', 'Payable Tax under 20% Slab');
  head('BA', 'Amount under 30% Tax Slab');
  head('BB', 'Payable Tax under 30% Slab');
  head('BC', 'Total Payable Tax Annually');
  head('BD', 'Total Payable Tax Monthly');
  const monthStart = col('BE');
  head('BE', 'Tax Deducted Monthly', months.map((m) => m.label.slice(0, 3)));
  const totalCol = monthStart + months.length;
  const balanceCol = totalCol + 1;
  put(totalCol, 0, str('Total Tax Deducted'));
  merges.push({ s: { c: totalCol, r: 0 }, e: { c: totalCol, r: 1 } });
  put(balanceCol, 0, str('Balance Tax Payable'));
  merges.push({ s: { c: balanceCol, r: 0 }, e: { c: balanceCol, r: 1 } });

  let y = 1;
  for (const p of people) {
    y++;
    const emp = Number(p.emp);
    const decl = p.decl === null || p.decl === undefined ? null : Number(p.decl);
    put(col('A'), y, str(p.code as string | null));
    put(col('B'), y, str(p.name as string));
    put(col('C'), y, str(p.doj as string | null));
    put(col('D'), y, num(p.ctc as string | null));
    put(col('E'), y, num(p.annual as string | null));
    put(col('F'), y, num(p.bonus as string | null));
    put(col('G'), y, num(p.pt as string | null));
    put(col('H'), y, num(p.medical as string | null));
    put(col('I'), y, num(p.telephone as string | null));
    put(col('J'), y, num(p.conveyance as string | null));

    const sections = decl ? await sectionRows(decl) : null;
    const benefit = sections ? Number(sections.header?.ACTUAL_AMOUNT ?? 0) : 0;
    const figures = setup ? await employeeTaxFigures(setup, emp, benefit) : null;
    put(col('K'), y, num(figures?.taxableBeforeInvestments));

    if (sections) {
      const { hra, home, nps, medical, dd, edu, don, dis, ts, header } = sections;
      if (hra && Number(hra.RENT_AMOUNT ?? 0)) {
        const f = await hraExemption(prisma, emp, String(hra.CITY_TYPE ?? ''), Number(hra.RENT_AMOUNT));
        put(col('L'), y, str(hra.CITY_NM as string | null));
        put(col('M'), y, num(hra.RENT_AMOUNT as string));
        put(col('N'), y, num(f.rentExemption));
        put(col('O'), y, num(f.hra));
        put(col('P'), y, num(f.cityBasis));
        put(col('Q'), y, num(hra.ACTUAL_AMOUNT as string | null));
      }
      if (home) {
        const rule = await matchingRule(prisma, scope, 'IPOAH', {
          selfOccupied: Number(home.SELF_OCCUPIED ?? 0), completionStatus: home.COMPLETION_STATUS as number | null, inSameCouncil: Number(home.IN_SAME_COUNCIL ?? 0),
        });
        put(col('R'), y, str(home.STATUS_NM as string | null));
        put(col('S'), y, str(yesNo(home.SELF_OCCUPIED)));
        put(col('T'), y, str(yesNo(home.IN_SAME_COUNCIL)));
        put(col('U'), y, num(home.LOAN_AMOUNT as string));
        put(col('V'), y, num(maxOf(rule, Number(home.LOAN_AMOUNT ?? 0))));
        put(col('W'), y, num(home.ACTUAL_AMOUNT as string | null));
      }
      if (nps) {
        const rule = await matchingRule(prisma, scope, 'IPCTN');
        put(col('X'), y, num(maxOf(rule, Number(nps.INVESTMENT_AMT ?? 0))));
        put(col('Y'), y, num(nps.INVESTMENT_AMT as string));
        put(col('Z'), y, num(nps.ACTUAL_AMOUNT as string | null));
      }
      if (medical.length) {
        const groups = [medical.filter((m) => String(m.INVESTMENT_TYPE).trim() === String(medChild)), medical.filter((m) => String(m.INVESTMENT_TYPE).trim() !== String(medChild))];
        for (const [i, rows] of groups.entries()) {
          if (!rows.length) continue;
          const c = col(i === 0 ? 'AA' : 'AD');
          let max = 0;
          for (const m of rows) max += maxOf(await matchingRule(prisma, scope, 'IPME', { expenses: m.INVESTMENT_TYPE as string, age: m.AGE as number }), Number(m.INVESTMENT_AMT ?? 0)) ?? 0;
          put(c, y, str([...new Set(rows.map((m) => (m.AGE_NM as string | null) ?? ''))].filter(Boolean).join(', ')));
          put(c + 1, y, num(max));
          put(c + 2, y, num(rows.reduce((s, m) => s + Number(m.INVESTMENT_AMT ?? 0), 0)));
        }
        put(col('AG'), y, num(medical.reduce((s, m) => s + Number(m.ACTUAL_AMOUNT ?? 0), 0)));
      }
      if (dd) {
        const rule = await matchingRule(prisma, scope, 'DDTYPE', { severe: dd.INVESTMENT_TPE as string });
        put(col('AH'), y, str(dd.TYPE_NM as string | null));
        put(col('AI'), y, num(maxOf(rule, Number(dd.INVESTMENT_AMT ?? 0))));
        put(col('AJ'), y, num(dd.INVESTMENT_AMT as string));
        put(col('AK'), y, num(dd.ACTUAL_AMOUNT as string));
      }
      if (edu) {
        put(col('AL'), y, str((edu.YEAR_NM as string | null) ?? (edu.YEAR as string | null)));
        put(col('AM'), y, num(edu.INTEREST_PAID as string));
        put(col('AN'), y, num(edu.ACTUAL_AMOUNT as string));
      }
      if (don) put(col('AO'), y, num(don.ACTUAL_AMOUNT as string | null));
      if (dis) {
        put(col('AP'), y, str(dis.TYPE_NM as string | null));
        put(col('AQ'), y, num(dis.ACTUAL_AMOUNT as string));
      }
      if (ts) {
        const rule = await matchingRule(prisma, scope, 'IPIITS');
        put(col('AR'), y, num(maxOf(rule, Number(ts.INVESTMENT_AMOUNT ?? 0))));
        put(col('AS'), y, num(ts.INVESTMENT_AMOUNT as string));
        put(col('AT'), y, num(ts.ACTUAL_AMOUNT as string));
      }
      put(col('AU'), y, num(header?.ACTUAL_AMOUNT as string | null));
    }

    const taxable = figures?.taxableIncome ?? null;
    put(col('AV'), y, num(taxable));
    // CI's fixed slabs (written when the income is above the first).
    if (taxable !== null && taxable > 250000) {
      const first = taxable < 500000 ? taxable - 250000 : 250000;
      const second = taxable < 500000 ? 0 : taxable < 1000000 ? taxable - 500000 : 500000;
      const third = taxable < 1000000 ? 0 : taxable - 1000000;
      [first, first * 0.05, second, second * 0.2, third, third * 0.3].forEach((v, i) => put(col('AW') + i, y, num(v)));
    }
    const payable = figures?.taxPayable ?? null;
    put(col('BC'), y, num(payable));
    put(col('BD'), y, num(payable === null ? null : payable / 12));
    let total = 0;
    months.forEach((m, j) => {
      const v = deducted.get(`${emp}|${m.key}`);
      if (v === undefined) return;
      total += v;
      put(monthStart + j, y, num(centsText(v)));
    });
    put(totalCol, y, num(centsText(total)));
    put(balanceCol, y, num(payable === null ? null : payable - total / 100));
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: balanceCol, r: Math.max(y, 1) } });
  ws['!merges'] = merges;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Worksheet');
  return { name: FILE, data: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer };
}

/** The declaration's sections as the export reads them (first live row each; medical: every live row), with names. */
async function sectionRows(id: number) {
  const one = async (sql: Promise<Array<Record<string, unknown>>>) => (await sql)[0] ?? null;
  const [header, hra, home, nps, medical, dd, edu, don, dis, ts] = await Promise.all([
    one(prisma.$queryRaw`SELECT "ACTUAL_AMOUNT"::text AS "ACTUAL_AMOUNT" FROM investment_mst_declaration WHERE "ID" = ${id}`),
    one(prisma.$queryRaw`
      SELECT t."CITY_TYPE", t."RENT_AMOUNT"::text AS "RENT_AMOUNT", t."ACTUAL_AMOUNT"::text AS "ACTUAL_AMOUNT",
        (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = t."CITY_TYPE" LIMIT 1) AS "CITY_NM"
      FROM emp_hra_details t WHERE t."INVESTMENT_ID" = ${id} AND COALESCE(t."IS_DELETED", 0) = 0 AND t."RENT_AMOUNT" > 0 ORDER BY t."ID" LIMIT 1`),
    one(prisma.$queryRaw`
      SELECT t."SELF_OCCUPIED", t."IN_SAME_COUNCIL", t."COMPLETION_STATUS", t."LOAN_AMOUNT"::text AS "LOAN_AMOUNT", t."ACTUAL_AMOUNT"::text AS "ACTUAL_AMOUNT",
        (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = t."COMPLETION_STATUS" LIMIT 1) AS "STATUS_NM"
      FROM emp_home_loan_details t WHERE t."INVESTMENT_ID" = ${id} AND COALESCE(t."IS_DELETED", 0) = 0 ORDER BY t."ID" LIMIT 1`),
    one(prisma.$queryRaw`
      SELECT t."INVESTMENT_AMT"::text AS "INVESTMENT_AMT", t."ACTUAL_AMOUNT"::text AS "ACTUAL_AMOUNT"
      FROM emp_nps t WHERE btrim(t."INVESTMENT_ID") = ${String(id)} AND COALESCE(t."IS_DELETED", 0) = 0 ORDER BY t."EL_ID" LIMIT 1`),
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT t."INVESTMENT_TYPE", t."AGE", t."INVESTMENT_AMT"::text AS "INVESTMENT_AMT", t."ACTUAL_AMOUNT"::text AS "ACTUAL_AMOUNT",
        (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = t."AGE" LIMIT 1) AS "AGE_NM"
      FROM medical_expenses_details t WHERE t."INVESTMENT_ID" = ${id} AND COALESCE(t."IS_DELETED", 0) = 0 ORDER BY t."EL_ID"`,
    one(prisma.$queryRaw`
      SELECT t."INVESTMENT_TPE", t."INVESTMENT_AMT"::text AS "INVESTMENT_AMT", t."ACTUAL_AMOUNT"::text AS "ACTUAL_AMOUNT",
        (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID"::text = btrim(t."INVESTMENT_TPE") LIMIT 1) AS "TYPE_NM"
      FROM dependent_disability t WHERE t."INVESTMENT_ID" = ${id} AND COALESCE(t."IS_DELETED", 0) = 0 ORDER BY t."EL_ID" LIMIT 1`),
    one(prisma.$queryRaw`
      SELECT t."YEAR", t."INTEREST_PAID"::text AS "INTEREST_PAID", t."ACTUAL_AMOUNT"::text AS "ACTUAL_AMOUNT",
        (SELECT p."FISCAL_PERIOD_DESC" FROM period_mst p WHERE p."PERIOD_ID"::text = btrim(t."YEAR") LIMIT 1) AS "YEAR_NM"
      FROM education_loan_details t WHERE t."INVESTMENT_ID" = ${id} AND COALESCE(t."IS_DELETED", 0) = 0 ORDER BY t."EL_ID" LIMIT 1`),
    one(prisma.$queryRaw`
      SELECT t."ACTUAL_AMOUNT"::text AS "ACTUAL_AMOUNT" FROM donations_details t
      WHERE btrim(t."INVESTMENT_ID") = ${String(id)} AND COALESCE(t."IS_DELETED", 0) = 0 ORDER BY t."EL_ID" LIMIT 1`),
    one(prisma.$queryRaw`
      SELECT t."ACTUAL_AMOUNT"::text AS "ACTUAL_AMOUNT",
        (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID"::text = btrim(t."DIS_TYPE") LIMIT 1) AS "TYPE_NM"
      FROM disability_emp t WHERE t."INVESTMENT_ID" = ${id} AND COALESCE(t."IS_DELETED", 0) = 0 ORDER BY t."EL_ID" LIMIT 1`),
    one(prisma.$queryRaw`
      SELECT t."INVESTMENT_AMOUNT"::text AS "INVESTMENT_AMOUNT", t."ACTUAL_AMOUNT"::text AS "ACTUAL_AMOUNT"
      FROM emp_tax_savings t WHERE t."INVESTMENT_ID" = ${id} AND COALESCE(t."IS_DELETED", 0) = 0 ORDER BY t."ID" LIMIT 1`),
  ]);
  return { header, hra, home, nps, medical, dd, edu, don, dis, ts };
}

import * as XLSX from 'xlsx';
import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { SqlBuilder } from '@/lib/employeeMngt/empList';
import { fullName, scopeSql } from '@/lib/employeeMngt/hub/hubEngine';
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { centsText, toCents } from '../annexure/ruleMath';
import { findFinancialYear } from '../financialYear';
import { fyMonths, reportFinancialYears, resolveFy, type ReportFy } from './periods';

/**
 * CI emp_sal_component_dtl professionalTax / MonthlyGrossReport / MonthlyNetReport (+ their Excel exports): one row per
 * employee, one column per month of a financial year — the payslip's Professional Tax line (SCPTX), its gross
 * (header ACTUAL_AMOUNT: the salary structure's monthly gross, before LOP, without incentives / arrears) or its net pay
 * (EARNED_AMOUNT).
 *
 * As CI: the whole brand for holders of the menu grant, the Employee filter optional, empty cells for months without a
 * payslip (or a Professional Tax line stored without an amount). Behaviour changes: the menu grant is checked (CI's URLs
 * were open to anyone); ids are validated and bound (CI concatenated them into SQL); a "Total" column and a totals row;
 * the export always follows the applied year (CI exported an empty one-column sheet when the year box was cleared);
 * amounts are exported as numbers with two decimals; closed years can be chosen (./periods.ts).
 */
export type ReportKind = 'pt' | 'gross' | 'net';
export const REPORT_KINDS: ReportKind[] = ['pt', 'gross', 'net'];

const MENU: Record<ReportKind, string> = {
  pt: 'employeeMngt/emp_sal_component_dtl/professionalTax',
  gross: 'employeeMngt/emp_sal_component_dtl/MonthlyGrossReport',
  net: 'employeeMngt/emp_sal_component_dtl/MonthlyNetReport',
};
export const REPORT_FILE: Record<ReportKind, string> = { pt: 'Professional Tax Report', gross: 'Monthly Gross Report', net: 'Monthly Net Report' };
const BREAKUP_MENU = 'employeeMngt/emp_sal_component_dtl/SalaryBreakUp';

const query = z.object({
  fy: z.coerce.number().int().nonnegative().optional(),
  emp: z.coerce.number().int().nonnegative().optional(),
});

export interface FyReport {
  fy: ReportFy;
  months: Array<{ key: string; label: string }>;
  rows: Array<{ empId: number; empCode: string | null; empName: string; cells: Record<string, string | null>; total: string }>;
  totals: { cells: Record<string, string>; total: string };
}

const SCPTX = `(SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = 'SCPTX' ORDER BY im."MSTR_ID" LIMIT 1)`;
const AMOUNT: Record<ReportKind, string> = {
  gross: 'ps."ACTUAL_AMOUNT"',
  net: 'ps."EARNED_AMOUNT"',
  pt: `(SELECT sum(d."ACTUAL_AMOUNT") FROM emp_basic_sal_dtl d WHERE d."SAL_MST_ID" = ps."EMP_SAL_ID" AND d."IS_DELETED" = 0 AND d."SAL_COMP_ID" = ${SCPTX})`,
};

async function brandOf(subject: RequestSubject): Promise<number> {
  const brand = subject.oaBrandId ?? null;
  if (!brand) throw new BusinessRuleError('Please select a brand.');
  return brand;
}

export async function fyMonthlyReport(subject: RequestSubject, kind: ReportKind, raw: Record<string, string>): Promise<FyReport> {
  if (!(await menuPolicy(MENU[kind]).check(subject, 'list'))) throw new ForbiddenError();
  const brand = await brandOf(subject);
  const parsed = query.safeParse(raw);
  if (!parsed.success) throw new ValidationError('Validation failed.', { fy: ['Select a valid Financial Year.'] });
  const fy = await resolveFy(brand, parsed.data.fy || null);
  const emp = parsed.data.emp || null;
  if (emp) {
    const [e] = await prisma.$queryRaw<Array<{ n: number }>>`SELECT 1 AS n FROM emp_mst WHERE "EMP_ID" = ${emp} AND "IS_DELETED" = 0 AND "OA_BRAND_ID" = ${brand}`;
    if (!e) throw new NotFoundError('Record not found.');
  }
  const months = fyMonths(fy.start, fy.end);
  const data = await prisma.$queryRawUnsafe<Array<{ empId: number; empCode: string | null; empName: string; month: string; amount: string | null }>>(
    `WITH ps AS (
       SELECT h."EMP_SAL_ID", h."EMP_ID", make_date(btrim(h."YEAR")::int, btrim(h."MONTH")::int, 1) AS m, h."ACTUAL_AMOUNT", h."EARNED_AMOUNT"
       FROM emp_basic_sal_mst h
       WHERE h."IS_DELETED" = 0
         AND h."SAL_TYPE" = (SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = 'PRSTPS' ORDER BY im."MSTR_ID" LIMIT 1)
         AND h."YEAR" ~ '^\\s*[0-9]{4}\\s*$' AND h."MONTH" ~ '^\\s*(0?[1-9]|1[0-2])\\s*$')
     SELECT em."EMP_ID" AS "empId", em."EMP_NBR" AS "empCode", ${fullName('em')} AS "empName", to_char(ps.m, 'YYYY-MM') AS month,
       (${AMOUNT[kind]})::text AS amount
     FROM ps JOIN emp_mst em ON em."EMP_ID" = ps."EMP_ID" AND em."IS_DELETED" = 0
     WHERE ps.m BETWEEN $1::date AND $2::date AND em."OA_BRAND_ID" = $3::int AND ($4::int IS NULL OR em."EMP_ID" = $4::int)
       ${kind === 'pt' ? `AND EXISTS (SELECT 1 FROM emp_basic_sal_dtl d WHERE d."SAL_MST_ID" = ps."EMP_SAL_ID" AND d."IS_DELETED" = 0 AND d."SAL_COMP_ID" = ${SCPTX})` : ''}
     ORDER BY em."EMP_ID", ps.m, ps."EMP_SAL_ID"`,
    fy.start, fy.end, brand, emp,
  );

  // Pivot in cents: two payslips of one employee-month (never live) are added; a NULL amount stays an empty cell.
  const byEmp = new Map<number, { empId: number; empCode: string | null; empName: string; cents: Map<string, number | null> }>();
  for (const r of data) {
    const id = Number(r.empId);
    let e = byEmp.get(id);
    if (!e) {
      e = { empId: id, empCode: r.empCode, empName: r.empName || `Employee #${id}`, cents: new Map() };
      byEmp.set(id, e);
    }
    const prev = e.cents.get(r.month);
    const v = r.amount === null ? null : toCents(r.amount);
    e.cents.set(r.month, v === null ? (prev ?? null) : (prev ?? 0) + v);
  }
  const monthTotals = new Map<string, number>(months.map((m) => [m.key, 0]));
  let grand = 0;
  const rows: FyReport['rows'] = [...byEmp.values()].map((e) => {
    const cells: Record<string, string | null> = {};
    let total = 0;
    for (const m of months) {
      const v = e.cents.get(m.key);
      cells[m.key] = v === undefined || v === null ? null : centsText(v);
      if (v) {
        total += v;
        monthTotals.set(m.key, (monthTotals.get(m.key) ?? 0) + v);
      }
    }
    grand += total;
    return { empId: e.empId, empCode: e.empCode, empName: e.empName, cells, total: centsText(total) };
  });
  return {
    fy, months, rows,
    totals: { cells: Object.fromEntries(months.map((m) => [m.key, centsText(monthTotals.get(m.key) ?? 0)])), total: centsText(grand) },
  };
}

/** The report as CI's sheet: "Worksheet", Employee Code / Employee Name / months, plus Total; amounts as numbers. */
export function fyMonthlyWorkbook(report: FyReport): Buffer {
  const money = (v: string | null): XLSX.CellObject | null => (v === null ? null : { t: 'n', v: Number(v), z: '0.00' });
  const aoa: Array<Array<string | number | null>> = [['Employee Code', 'Employee Name', ...report.months.map((m) => m.label), 'Total']];
  for (const r of report.rows) aoa.push([r.empCode ?? '', r.empName, ...report.months.map(() => null), null]);
  aoa.push(['', 'Total', ...report.months.map(() => null), null]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const set = (c: number, row: number, cell: XLSX.CellObject | null) => {
    const ref = XLSX.utils.encode_cell({ c, r: row });
    if (cell) ws[ref] = cell;
    else delete ws[ref];
  };
  report.rows.forEach((r, i) => {
    report.months.forEach((m, j) => set(2 + j, i + 1, money(r.cells[m.key])));
    set(2 + report.months.length, i + 1, money(r.total));
  });
  const last = report.rows.length + 1;
  report.months.forEach((m, j) => set(2 + j, last, money(report.totals.cells[m.key])));
  set(2 + report.months.length, last, money(report.totals.total));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Worksheet');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/**
 * The reports' filters: the brand's financial years, the default one and the employees (`for`: a pivot kind, or
 * "breakup" — the years of the Salary Breakup rows the caller may see).
 */
export async function reportOptions(subject: RequestSubject, forKind: string) {
  const breakup = forKind === 'breakup';
  const kind = REPORT_KINDS.find((k) => k === forKind);
  if (!breakup && !kind) throw new NotFoundError();
  if (!(await menuPolicy(breakup ? BREAKUP_MENU : MENU[kind!]).check(subject, 'list'))) throw new ForbiddenError();
  const brand = subject.oaBrandId ?? null;
  const years = brand ? await reportFinancialYears(brand) : [];
  const now = new Date();
  const current = brand ? await findCurrent(brand, years, now) : null;

  if (breakup) {
    // The years that occur in the caller's breakup rows (deleted / unknown periods labelled as such).
    const sql = new SqlBuilder();
    const scope = await scopeSql(subject, sql);
    const rows = await prisma.$queryRawUnsafe<Array<{ id: number; name: string | null; start: string | null; deleted: number | null }>>(
      `SELECT DISTINCT t."YEAR" AS id, p."FISCAL_PERIOD_DESC" AS name, to_char(p."PERIOD_START_DATE", 'YYYY-MM-DD') AS start, p."IS_DELETED" AS deleted
       FROM salary_breakup t JOIN emp_mst em ON em."EMP_ID" = t."EMP_ID" LEFT JOIN period_mst p ON p."PERIOD_ID" = t."YEAR"
       WHERE t."IS_DELETED" = 0 AND t."BASIC" > 0 AND em."IS_DELETED" = 0 AND t."YEAR" IS NOT NULL AND ${scope}
       ORDER BY start DESC NULLS LAST, id DESC`,
      ...sql.params,
    );
    const known = new Map(years.map((y) => [y.id, y.label]));
    const financialYears = rows.map((r) => ({
      value: Number(r.id),
      label: known.get(Number(r.id)) ?? (r.name ? `${r.name}${Number(r.deleted) ? ' (deleted period)' : ''}` : `#${r.id}`),
    }));
    const defaultFy = current && financialYears.some((y) => y.value === current) ? current : (financialYears[0]?.value ?? null);
    return { financialYears, defaultFy, employees: [], message: brand ? null : 'Select a brand first.' };
  }

  const employees = brand
    ? await prisma.$queryRawUnsafe<Array<{ value: number; label: string; code: string | null }>>(
      `SELECT em."EMP_ID" AS value, ${fullName('em')} AS label, em."EMP_NBR" AS code FROM emp_mst em
       WHERE em."IS_DELETED" = 0 AND em."OA_BRAND_ID" = $1::int ORDER BY label, em."EMP_ID"`,
      brand,
    )
    : [];
  return {
    financialYears: years.map((y) => ({ value: y.id, label: y.label })),
    defaultFy: current ?? years[0]?.id ?? null,
    employees: employees.map((e) => ({ value: Number(e.value), label: e.code ? `${e.label || `Employee #${e.value}`} (${e.code})` : e.label })),
    message: brand ? null : 'Please select a brand.',
  };
}

async function findCurrent(brand: number, years: ReportFy[], now: Date): Promise<number | null> {
  const fy = await findFinancialYear(brand, now.getMonth() + 1, now.getFullYear());
  return fy && years.some((y) => y.id === fy.id) ? fy.id : null;
}

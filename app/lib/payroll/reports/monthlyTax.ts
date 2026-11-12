import * as XLSX from 'xlsx';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { BusinessRuleError, ForbiddenError, ValidationError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { centsText, toCents } from '../annexure/ruleMath';
import { fyMonths, resolveFy } from './periods';

/**
 * CI emp_investment_declarations::exportMonthlyTaxDeduction (Salary Breakup → "Generate Monthly Tax Deduction"):
 * "Monthly Tax Deducation Report.xlsx" (CI's name, typo kept) — per salary breakup row of a financial year: the employee,
 * date of joining, annual CTC, the year's actual CTC (CTC + incentives / arrears), the income tax each month's payslip
 * deducted, and the year's total.
 *
 * Behaviour changes: admins with the Salary Breakup grant only (CI's POST was open to anyone); the year is required and
 * must be one of the brand's (CI broke with an SQL error); the month headers are always written (CI wrote them only
 * with the first data row); only payslips count (CI did not check the header type); one query (CI ran 12 per employee);
 * a year of more than 12 months works (CI crashed); amounts are numbers with two decimals.
 */
const MENU = 'employeeMngt/emp_sal_component_dtl/SalaryBreakUp';
const FILE = 'Monthly Tax Deducation Report.xlsx';

export async function monthlyTaxWorkbook(subject: RequestSubject, rawFy: string | undefined): Promise<{ name: string; data: Buffer }> {
  if (subject.adminLevel === 0 || !(await menuPolicy(MENU).check(subject, 'list'))) throw new ForbiddenError();
  const brand = subject.oaBrandId ?? null;
  if (!brand) throw new BusinessRuleError('Select a brand first.');
  const id = Number(rawFy);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Validation failed.', { fy: ['The Financial Year field is required.'] });
  const fy = await resolveFy(brand, id);
  const months = fyMonths(fy.start, fy.end);

  const rows = await prisma.$queryRaw<Array<{ slb: number; code: string | null; name: string; doj: string | null; ctc: string | null; annual: string | null; month: string | null; tax: string | null }>>`
    WITH sb AS (
      SELECT t."SLB_ID", t."EMP_ID", t."CTC", t."ANNUAL_SALARY", em."EMP_NBR",
        btrim(COALESCE(em."EMP_NAME", '') || ' ' || COALESCE(em."EMPLST_NM", '')) AS name,
        (SELECT j."DATE_OF_JOINING" FROM job_mst j WHERE j."EMP_ID" = t."EMP_ID" AND j."IS_DELETED" = 0 ORDER BY j."JOB_ID" LIMIT 1) AS doj
      FROM salary_breakup t JOIN emp_mst em ON em."EMP_ID" = t."EMP_ID" AND em."IS_DELETED" = 0
      WHERE t."YEAR" = ${fy.id} AND t."IS_DELETED" = 0 AND t."BASIC" > 0 AND em."OA_BRAND_ID" = ${brand})
    SELECT sb."SLB_ID" AS slb, sb."EMP_NBR" AS code, sb.name, to_char(sb.doj, 'FMDD-Mon-YYYY') AS doj, sb."CTC"::text AS ctc,
      sb."ANNUAL_SALARY"::text AS annual, to_char(make_date(btrim(h."YEAR")::int, btrim(h."MONTH")::int, 1), 'YYYY-MM') AS month,
      sum(d."ACTUAL_AMOUNT")::text AS tax
    FROM sb
    LEFT JOIN emp_basic_sal_mst h ON h."EMP_ID" = sb."EMP_ID" AND h."IS_DELETED" = 0
      AND h."SAL_TYPE" = (SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = 'PRSTPS' ORDER BY im."MSTR_ID" LIMIT 1)
      AND btrim(h."YEAR") ~ '^[0-9]{4}$' AND btrim(h."MONTH") ~ '^(0?[1-9]|1[0-2])$'
      AND make_date(btrim(h."YEAR")::int, btrim(h."MONTH")::int, 1) BETWEEN ${fy.start}::date AND ${fy.end}::date
    LEFT JOIN emp_basic_sal_dtl d ON d."SAL_MST_ID" = h."EMP_SAL_ID" AND d."IS_DELETED" = 0
      AND d."SAL_COMP_ID" = (SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = 'SCINTX' ORDER BY im."MSTR_ID" LIMIT 1)
    GROUP BY sb."SLB_ID", sb."EMP_NBR", sb.name, sb.doj, sb."CTC", sb."ANNUAL_SALARY", month
    ORDER BY sb."SLB_ID", month`;

  const people = new Map<number, { code: string | null; name: string; doj: string | null; ctc: string | null; annual: string | null; tax: Map<string, number | null> }>();
  for (const r of rows) {
    const slb = Number(r.slb);
    let p = people.get(slb);
    if (!p) {
      p = { code: r.code, name: r.name, doj: r.doj, ctc: r.ctc, annual: r.annual, tax: new Map() };
      people.set(slb, p);
    }
    if (r.month) p.tax.set(r.month, r.tax === null ? null : toCents(r.tax));
  }

  const num = (v: string | null): XLSX.CellObject | null => (v === null ? null : { t: 'n', v: Number(v), z: '0.00' });
  const ws: XLSX.WorkSheet = {};
  const put = (c: number, r: number, cell: XLSX.CellObject | null) => {
    if (cell) ws[XLSX.utils.encode_cell({ c, r })] = cell;
  };
  ['Employee Id', 'Employee Name', 'Date of Joining', 'Annual CTC', 'Actual Current Year CTC', ...months.map((m) => m.label.slice(0, 3)), 'Total Tax Deducted']
    .forEach((h, c) => put(c, 0, { t: 's', v: h }));
  let y = 0;
  for (const p of people.values()) {
    y++;
    put(0, y, { t: 's', v: p.code ?? '' });
    put(1, y, { t: 's', v: p.name });
    put(2, y, { t: 's', v: p.doj ?? '' });
    put(3, y, num(p.ctc));
    put(4, y, num(p.annual));
    let total = 0;
    months.forEach((m, j) => {
      const v = p.tax.get(m.key);
      if (v !== undefined && v !== null) {
        total += v;
        put(5 + j, y, num(centsText(v)));
      }
    });
    put(5 + months.length, y, num(centsText(total)));
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 5 + months.length, r: Math.max(y, 0) } });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Worksheet');
  return { name: FILE, data: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer };
}

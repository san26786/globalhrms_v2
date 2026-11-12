import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { SqlBuilder } from '@/lib/employeeMngt/empList';
import { fullName, scopeSql, type Tx } from '@/lib/employeeMngt/hub/hubEngine';
import { NotFoundError } from '@/lib/http/errors';
import { getMasterIds } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { amountInWords } from './words';

/**
 * CI emp_sal_component_mst show_preview / downloadPaySlip / generatePayslipPdf (common_helper generateSalaryTemplate,
 * "Standard Payslip For India" — the template every brand uses): a payslip as a PDF, A4 landscape — brand header,
 * employee details, Earnings / Deductions / WD Calculation, totals, net pay in words.
 *
 * Behaviour changes: rendered from the stored rows on every request (CI wrote a file once and served it by id to
 * anyone, logged in or not); only to users with Payroll Processing or My Payslips, for payslips in their scope — a
 * normal user only their own, once paid; the brand is the employee's (CI: the session's); a component the payslip
 * does not have is left out (CI printed empty lines); Cost Center shows the cost center (CI: always blank), Grade the
 * grade (CI printed the band), a missing joining date is blank (CI printed today's date); the amount in words is
 * spelled correctly (./words.ts); LOP days are those the run stored, else worked out from the LOP amount (CI re-read
 * attendance, which may have changed since).
 */
const MENUS = ['employeeMngt/emp_sal_component_mst', 'employeeMngt/emp_sal_component_mst/paySlip'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MARGIN = 40;

type Text = string | null;

export interface PayslipLine {
  name: string;
  amount: string;
}

/** What the document shows — from the stored rows (or, for a preview, from the computed payslip). */
export interface PayslipDocumentData {
  month: number;
  year: number;
  brand: { name: string; address: Text };
  employee: { id: number; code: Text; name: string; department: Text; costCenter: Text; pan: Text; location: Text; designation: Text; grade: Text; joined: Text; gender: Text; account: Text };
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  lop: string;
  lopDays: string;
  net: string;
}

const money = (v: string | number | null | undefined) => Number(v ?? 0).toFixed(2);
const grouped = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const daysIn = (month: number, year: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const fileSafe = (v: string) => v.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'employee';
const doj = (d: Text) => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}-${SHORT[Number(m) - 1]}-${y.slice(2)}`;
};

/** LOP days as stored by the run (the LOP line's description), else derived from the amount (half-day steps). */
export function lopDays(stored: Text, lop: number, actual: number, days: number): string {
  if (stored && /^\d+(\.\d+)?$/.test(stored.trim())) return String(Number(stored.trim()));
  if (!lop || !actual) return '0';
  return String(Math.round(((lop * days) / actual) * 2) / 2);
}

/** The brand's earnings / deductions sections (enabled, visible in salary) with the payslip's first line per component. */
export async function payslipSections(brand: number, lines: Map<number, string>) {
  const codes = await getMasterIds(['SCBS', 'SCLOP']);
  const settings = await prisma.$queryRaw<Array<{ component: number; name: string; type: string }>>`
    SELECT s."COMPONENT_ID" AS component, im."MSTR_NM" AS name, ct."MSTR_CD" AS type
    FROM salary_component_settings s
    JOIN independent_mst im ON im."MSTR_ID" = s."COMPONENT_ID"
    JOIN independent_mst ct ON ct."MSTR_ID" = s."COMPONENT_TYPE"
    WHERE s."OA_BRAND_ID" = ${brand} AND s."IS_DELETED" = 0 AND s."IS_ENABLED" = 1 AND s."VISIBLE_IN_SALARY" = 1
      AND ct."MSTR_CD" IN ('CMPTA', 'CMPTD', 'CMPTC')
    ORDER BY s."SC_ID"`;
  const [basicName] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT "MSTR_NM" AS name FROM independent_mst WHERE "MSTR_ID" = ${codes.SCBS ?? -1}`;
  const earnings: PayslipLine[] = [];
  if (codes.SCBS && lines.has(codes.SCBS)) earnings.push({ name: basicName?.name ?? 'Basic', amount: money(lines.get(codes.SCBS)) });
  for (const s of settings.filter((x) => x.type === 'CMPTA')) {
    if (lines.has(Number(s.component))) earnings.push({ name: s.name, amount: money(lines.get(Number(s.component))) });
  }
  const deductions = [...settings.filter((x) => x.type === 'CMPTD'), ...settings.filter((x) => x.type === 'CMPTC')]
    .map((s) => ({ name: s.name, amount: money(lines.get(Number(s.component)) ?? 0) }));
  return { earnings, deductions, lop: money(codes.SCLOP ? lines.get(codes.SCLOP) : 0), lopComponent: codes.SCLOP };
}

async function documentData(subject: RequestSubject, rawId: string): Promise<PayslipDocumentData> {
  const allowed = await Promise.all(MENUS.map((m) => menuPolicy(m).check(subject, 'list')));
  const id = Number(rawId);
  if (!allowed.some(Boolean) || !Number.isInteger(id) || id <= 0) throw new NotFoundError('Record not found.');
  const sql = new SqlBuilder();
  const scope = await scopeSql(subject, sql);
  // A normal user sees a payslip only once it is released (paid), as the My Payslips list.
  const released = subject.adminLevel === 0 ? 'AND t."TRANSACTION_STATUS" > 0' : '';
  const data = await readPayslipDocument(prisma, id, sql, `${scope} ${released}`);
  if (!data) throw new NotFoundError('Record not found.');
  return data;
}

/** A payslip's document data, read through `db` (a preview reads its own uncommitted payslip); no access check. */
export async function readPayslipDocument(db: Tx, id: number, sql = new SqlBuilder(), condition = 'TRUE'): Promise<PayslipDocumentData | null> {
  const [r] = await db.$queryRawUnsafe<Array<Record<string, Text | number>>>(
    `SELECT t."EMP_SAL_ID" AS id, em."EMP_ID" AS emp, btrim(t."MONTH") AS month, btrim(t."YEAR") AS year, t."ACTUAL_AMOUNT"::text AS actual,
       t."EARNED_AMOUNT"::text AS net, em."EMP_NBR" AS code, ${fullName('em')} AS name, em."EMP_PAN_NBR" AS pan, em."OA_BRAND_ID" AS brand,
       (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = em."GENDER_ID" LIMIT 1) AS gender,
       (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = j."DEPARTMENT_ID" LIMIT 1) AS department,
       (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = j."DESIGNATION_ID" LIMIT 1) AS designation,
       COALESCE((SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = j."EMP_GRADE_ID" LIMIT 1),
                (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = j."EMP_BAND_ID" LIMIT 1)) AS grade,
       (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID"::text = btrim(j."COST_CENTER"::text) LIMIT 1) AS cost_center,
       to_char(j."DATE_OF_JOINING", 'YYYY-MM-DD') AS joined,
       (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" =
          (SELECT l."LOCATION_ID" FROM emp_reporting_locations l WHERE l."EMP_ID" = em."EMP_ID" AND l."IS_DELETED" = 0
           ORDER BY l."EMP_REPORTING_LOCATIONS_ID" DESC LIMIT 1) LIMIT 1) AS location,
       (SELECT b."ACCOUNT_NO" FROM bank_dtl b WHERE b."EMP_ID" = em."EMP_ID" AND b."IS_PRIMARY" = 1
          AND btrim(COALESCE(b."IS_DELETED", '0'), '''') = '0' ORDER BY b."BANK_ID" DESC LIMIT 1) AS account,
       ob."OA_BRAND_NM" AS brand_name, ob."ADDRESS" AS brand_address
     FROM emp_basic_sal_mst t
     JOIN emp_mst em ON em."EMP_ID" = t."EMP_ID"
     JOIN oa_brands ob ON ob."OA_BRAND_ID" = em."OA_BRAND_ID"
     LEFT JOIN LATERAL (SELECT * FROM job_mst x WHERE x."EMP_ID" = em."EMP_ID" AND x."IS_DELETED" = 0 ORDER BY x."JOB_ID" DESC LIMIT 1) j ON true
     WHERE t."EMP_SAL_ID" = ${sql.p(id)}::int AND t."IS_DELETED" = 0 AND em."IS_DELETED" = 0
       AND t."SAL_TYPE" = (SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = 'PRSTPS' ORDER BY im."MSTR_ID" LIMIT 1)
       AND ${condition}`,
    ...sql.params,
  );
  if (!r) return null;
  const rows = await db.$queryRaw<Array<{ component: number; amount: string; descr: Text }>>`
    SELECT DISTINCT ON (d."SAL_COMP_ID") d."SAL_COMP_ID" AS component, d."ACTUAL_AMOUNT"::text AS amount, d."COMPONENT_DESC" AS descr
    FROM emp_basic_sal_dtl d WHERE d."SAL_MST_ID" = ${id} AND d."IS_DELETED" = 0 AND d."SAL_COMP_ID" IS NOT NULL
    ORDER BY d."SAL_COMP_ID", d."EMP_BASIC_SAL_DTL_ID"`;
  const lines = new Map(rows.map((x) => [Number(x.component), x.amount]));
  const sections = await payslipSections(Number(r.brand), lines);
  const month = Number(r.month);
  const year = Number(r.year);
  const lopRow = rows.find((x) => Number(x.component) === sections.lopComponent);
  const t = (v: Text | number | undefined) => (v === null || v === undefined || v === '' ? null : String(v));
  return {
    month,
    year,
    brand: { name: String(r.brand_name ?? ''), address: t(r.brand_address) },
    employee: {
      id: Number(r.emp), code: t(r.code), name: String(r.name ?? ''), department: t(r.department), costCenter: t(r.cost_center), pan: t(r.pan),
      location: t(r.location), designation: t(r.designation), grade: t(r.grade), joined: t(r.joined), gender: t(r.gender), account: t(r.account),
    },
    earnings: sections.earnings,
    deductions: sections.deductions,
    lop: sections.lop,
    lopDays: lopDays(lopRow?.descr ?? null, Number(sections.lop), Number(r.actual ?? 0), daysIn(month, year)),
    net: money(t(r.net)),
  };
}

/** The India standard layout (CI generateSalaryTemplate). `preview`: watermark "PREVIEW — not saved". */
export function renderPayslip(data: PayslipDocumentData, opts: { preview?: boolean } = {}): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const styles = { font: 'times', fontSize: 10, cellPadding: 3, lineColor: 0, lineWidth: 0.75, textColor: 0 } as const;
  const margin = { left: MARGIN, right: MARGIN };
  const bold = { fontStyle: 'bold' as const };
  const centre = { halign: 'center' as const };
  const right = { halign: 'right' as const };
  const last = () => (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: MARGIN, margin, theme: 'grid', styles,
    body: [
      // CI: one cell — the brand name in bold over its address.
      [{ content: data.brand.name, styles: { ...centre, ...bold, fontSize: 11, cellPadding: { top: 12, bottom: 2, left: 3, right: 3 }, lineWidth: { top: 0.75, left: 0.75, right: 0.75, bottom: 0 } } }],
      [{ content: data.brand.address ?? '', styles: { ...centre, cellPadding: { top: 0, bottom: 6, left: 3, right: 3 }, lineWidth: { top: 0, left: 0.75, right: 0.75, bottom: 0.75 } } }],
      [{ content: `Payslip for the month of ${MONTHS[data.month - 1] ?? ''} ${data.year}`, styles: { ...centre, ...bold } }],
    ],
  });

  const e = data.employee;
  const label = (s: string) => ({ content: s, styles: bold });
  autoTable(doc, {
    startY: last() + 10, margin, theme: 'grid', styles,
    body: [
      [label('Employee ID'), e.code ?? String(e.id), label('Employee Name'), { content: e.name, colSpan: 3 }],
      [label('Department'), e.department ?? '', label('Cost Center'), e.costCenter ?? '', label('PAN Number'), e.pan ?? ''],
      [label('Location'), e.location ?? '', label('Designation'), e.designation ?? '', label('Grade'), e.grade ?? ''],
      [label('Date of Joining'), doj(e.joined), label('Gender'), e.gender ?? '', label('Bank A/c No.'), e.account ?? ''],
    ],
  });

  const n = Math.max(data.earnings.length, data.deductions.length, 3);
  const wd = [['Days In Month', String(daysIn(data.month, data.year))], ['LOP Days', data.lopDays]];
  const body: RowInput[] = [];
  for (let i = 0; i < n; i++) {
    const er = data.earnings[i];
    const dr = data.deductions[i];
    body.push([
      { content: er?.name ?? '', styles: bold }, { content: er?.amount ?? '', styles: right },
      { content: dr?.name ?? '', styles: bold }, { content: dr?.amount ?? '', styles: right },
      { content: wd[i]?.[0] ?? '', styles: bold }, { content: wd[i]?.[1] ?? '', styles: right },
    ]);
  }
  const earned = data.earnings.reduce((s, l) => s + Number(l.amount), 0) - Number(data.lop);
  const deducted = data.deductions.reduce((s, l) => s + Number(l.amount), 0);
  body.push([
    label('Total Earnings'), { content: grouped(earned), styles: right }, label('Total Deductions'), { content: grouped(deducted), styles: right },
    label('LOP Deductions'), { content: data.lop, styles: right },
  ]);
  body.push([{ content: '', colSpan: 6 }]);
  body.push([{ content: `Net Pay Rs. ${data.net} ( In Words ${amountInWords(data.net)} )`, colSpan: 6, styles: bold }]);
  autoTable(doc, {
    startY: last() + 10, margin, theme: 'grid', styles,
    head: [['Earnings', 'Amount', 'Deductions', 'Amount', 'WD Calculation', 'Amount']],
    headStyles: { ...bold, ...centre, fillColor: false, textColor: 0, lineColor: 0, lineWidth: 0.75 },
    body,
  });

  autoTable(doc, {
    startY: last() + 14, margin, theme: 'plain', styles: { ...styles, lineWidth: 0, fontStyle: 'bold' },
    body: [
      ['WD - Working Days', { content: 'Total Earning = Sum of Monthly Earnings - LOP Deduction', styles: centre }],
      ['LOP - Loss Of Pay', { content: 'Net Pay = Total Earning - Professional Tax - Income Tax - Loans and Advance', styles: centre }],
    ],
  });

  if (opts.preview) {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setTextColor(170).setFont('times', 'bold').setFontSize(48);
    doc.text('PREVIEW — not saved', w / 2, h / 2, { align: 'center', angle: 30 });
    doc.setTextColor(0);
  }
  return doc;
}

export const payslipDocumentService = {
  async render(subject: RequestSubject, id: string): Promise<{ name: string; data: Buffer }> {
    const data = await documentData(subject, id);
    const doc = renderPayslip(data);
    doc.setProperties({ title: `Payslip - ${data.employee.name}`, author: data.brand.name, creator: 'Global HR' });
    const period = `${String(data.month).padStart(2, '0')}-${data.year}`;
    return { name: `Payslip_${fileSafe(data.employee.code ?? String(data.employee.id))}_${period}.pdf`, data: Buffer.from(doc.output('arraybuffer')) };
  },

  /** Generate Salary's Preview: the computed, unsaved payslip with the "PREVIEW — not saved" watermark. */
  preview(data: PayslipDocumentData): { name: string; data: Buffer } {
    const doc = renderPayslip(data, { preview: true });
    doc.setProperties({ title: 'Salary Preview', author: data.brand.name, creator: 'Global HR' });
    const period = `${String(data.month).padStart(2, '0')}-${data.year}`;
    return { name: `Payslip_Preview_${fileSafe(data.employee.code ?? String(data.employee.id))}_${period}.pdf`, data: Buffer.from(doc.output('arraybuffer')) };
  },
};

import { jsPDF } from 'jspdf';
import autoTable, { type CellInput, type RowInput } from 'jspdf-autotable';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { SqlBuilder } from '@/lib/employeeMngt/empList';
import { fullName, masterName, scopeSql } from '@/lib/employeeMngt/hub/hubEngine';
import { NotFoundError, ValidationError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { parseId } from '@/lib/systmMngt/shared';
import { quartersOfForm16 } from './quarters';
import { periodInfo, requireForm16, type PeriodInfo } from './shared';

/**
 * CI form16/form16 Form16PdfData / previewForm16 / generateForm16 (common_helper Form_16): the Form 16 certificate as
 * a two-page A4 PDF.
 *   Part A — employer (brand name / address) and employee (name / Form 16 address), PAN / TAN of the deductor, PAN of
 *   the employee, CIT (TDS), assessment year, period with the employer (financial year dates), the quarter summary
 *   (receipt numbers, amount paid, tax deducted, totals), "I. … book adjustment" (empty, as CI), "II. … challan"
 *   (BSR code, deposit date, challan serial number, OLTAS status per quarter, total) and the verification text.
 *   Part B (Annexure) — deductor / employee / period header and the salary computation CI printed: 1 Gross salary
 *   (Form 16 Salary), 2 exempt allowances (HRA, conveyance, medical, telephone of the employee's salary breakup),
 *   3 balance, 4–5 tax on employment (professional tax), 6 / 8 income chargeable; the other lines print NIL, as CI.
 *
 * Assessment year / financial year: the stored ones when the form16 table has those columns, else those passed with
 * the request (the form's current choice — CI took the financial year from the posted form).
 *
 * Behaviour changes: rendered on demand from the stored rows (CI's "generate" wrote a file under form_16/ that nothing
 * linked to; here it downloads); only for Form 16s in the caller's scope under the form16/form16 grant (CI: any id);
 * deleted quarters are left out (CI's view listed them); the salary breakup is the Form 16's financial year's (CI
 * took the employee's first row of any year) and falls back to the first row when no year is chosen; brand = the
 * employee's (CI: the session's); CIT (TDS) is the brand's Tax Office Address when set (CI printed a fixed Pune
 * address, still the fallback); line 11 prints the total income (CI printed "Rs." with no amount); amounts print
 * with two decimals; "NILL" / "Chalan" / "andcorrect" are spelled NIL / Challan / and correct.
 */

/** CI's fixed CIT (TDS) text — used when the brand has no Tax Office Address. */
export const CI_CIT_ADDRESS = 'The Commissioner of Income Tax (TDS)\n4th Floor, A Wing, PMT Commercial Complex, Shankar Sheth Road, Swargate, Pune - 411037';

export interface Form16Quarter {
  quarter: string;
  receiptNo: string;
  amount: number;
  amountTax: number;
  bsrCode: string;
  taxDate: string;
  challanNo: string;
  oltas: string;
}

export interface Form16DocumentData {
  id: number;
  brand: { name: string; address: string; cit: string };
  employee: { name: string; code: string; pan: string };
  address: { line1: string; line2: string; line3: string; city: string; postalCode: string; country: string };
  pan: string;
  tan: string;
  assessmentYear: string;
  period: { start: string; end: string };
  salary: number;
  breakup: { hra: number; conveyance: number; medical: number; telephone: number; professionalTax: number };
  quarters: Form16Quarter[];
}

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const t = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
export const rs = (n: number) => n.toFixed(2);
const fileSafe = (v: string) => v.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'employee';

/** CI Form_16 sums: quarter totals, exempt allowances, balance (1-2), income chargeable (3-5). */
export function form16Totals(d: Form16DocumentData) {
  const amount = d.quarters.reduce((s, q) => s + q.amount, 0);
  const tax = d.quarters.reduce((s, q) => s + q.amountTax, 0);
  const allowance = d.breakup.hra + d.breakup.conveyance + d.breakup.medical + d.breakup.telephone;
  const balance = d.salary - allowance;
  const chargeable = balance - d.breakup.professionalTax;
  return { amount, tax, allowance, balance, chargeable };
}

/** A period given with the request: one of the employee's brand's periods of that type. */
async function postedPeriod(raw: string | undefined, type: 'OPTAY' | 'OPTFY', brand: number, label: string): Promise<PeriodInfo | null> {
  if (!raw) return null;
  const id = Number(raw);
  const p = Number.isInteger(id) && id > 0 ? await periodInfo(id) : null;
  if (!p || p.type !== type || p.brand !== brand) throw new ValidationError(`Select a valid ${label}.`, { [type === 'OPTAY' ? 'PERIOD_ID' : 'FINANCIAL_PERIOD_ID']: [`Select a valid ${label}.`] });
  return p;
}

/** CI Form16PdfData($id). */
export async function form16DocumentData(subject: RequestSubject, rawId: string, query: { period?: string; fy?: string } = {}): Promise<Form16DocumentData> {
  await requireForm16(subject, 'list');
  const id = parseId(rawId);
  const sql = new SqlBuilder();
  const scope = await scopeSql(subject, sql);
  const [r] = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT t."FORM16_ID" AS id, t."ADDRESS1", t."ADDRESS2", t."ADDRESS3", t."POSTAL_CODE", t."CITY", ${masterName('t."COUNTRY"')} AS "COUNTRY_NM",
       t."SALARY", t."PAN", t."TAN", (to_jsonb(t) ->> 'PERIOD_ID') AS "PERIOD_ID", (to_jsonb(t) ->> 'FINANCIAL_PERIOD_ID') AS "FINANCIAL_PERIOD_ID",
       em."EMP_ID" AS emp, em."EMP_NBR", ${fullName('em')} AS "EMP_NM", em."EMP_PAN_NBR", em."OA_BRAND_ID" AS brand,
       ob."OA_BRAND_NM", ob."ADDRESS" AS "BRAND_ADDRESS", ob."TAX_OFFICE_ADDRESS"
     FROM form16 t JOIN emp_mst em ON em."EMP_ID" = t."EMP_ID"
     LEFT JOIN oa_brands ob ON ob."OA_BRAND_ID" = em."OA_BRAND_ID"
     WHERE t."FORM16_ID" = ${sql.p(id)}::int AND t."IS_DELETED" = 0 AND em."IS_DELETED" = 0 AND ${scope} LIMIT 1`,
    ...sql.params,
  );
  if (!r) throw new NotFoundError('Record not found.');
  const brand = Number(r.brand);
  const storedId = (v: unknown) => (/^\d+$/.test(t(v)) && Number(v) > 0 ? Number(v) : null);
  const [ay, fy] = await Promise.all([
    postedPeriod(query.period, 'OPTAY', brand, 'Period').then(async (p) => p ?? periodInfo(storedId(r.PERIOD_ID))),
    postedPeriod(query.fy, 'OPTFY', brand, 'Financial Period').then(async (p) => p ?? periodInfo(storedId(r.FINANCIAL_PERIOD_ID))),
  ]);

  // CI getHra($emp_id): HRA, conveyance, medical, telephone allowance and professional tax of salary_breakup.
  const [sb] = await prisma.$queryRaw<Array<{ hra: string | null; conv: string | null; med: string | null; tel: string | null; pt: string | null }>>`
    SELECT "HRA"::text AS hra, "CONVEYANCE_ALLOWANCE"::text AS conv, "MEDICAL_ALLOWANCE"::text AS med, "TELEPHONE_ALLOWANCE"::text AS tel,
      "PROFESSIONAL_TAX"::text AS pt
    FROM salary_breakup
    WHERE "EMP_ID" = ${Number(r.emp)} AND COALESCE("IS_DELETED", 0) = 0 AND (${fy?.id ?? null}::int IS NULL OR "YEAR" = ${fy?.id ?? null}::int)
    ORDER BY "SLB_ID" LIMIT 1`;

  const quarters = (await quartersOfForm16(id)).map((q) => ({
    quarter: t(q.QUARTERS_NM),
    receiptNo: t(q.RECEIPT_NO),
    amount: num(q.AMOUNT),
    amountTax: num(q.AMOUNT_TAX),
    bsrCode: t(q.BSR_CODE),
    taxDate: t(q.TAX_DATE),
    challanNo: t(q.CHALLAN_SL_NO),
    oltas: t(q.OLTAS_STATUS_NM),
  }));

  const postal = t(r.POSTAL_CODE);
  return {
    id,
    brand: { name: t(r.OA_BRAND_NM), address: t(r.BRAND_ADDRESS), cit: t(r.TAX_OFFICE_ADDRESS) || CI_CIT_ADDRESS },
    employee: { name: t(r.EMP_NM), code: t(r.EMP_NBR), pan: t(r.EMP_PAN_NBR) },
    address: {
      line1: t(r.ADDRESS1), line2: t(r.ADDRESS2), line3: t(r.ADDRESS3), city: t(r.CITY), postalCode: postal === '0' ? '' : postal, country: t(r.COUNTRY_NM),
    },
    pan: t(r.PAN),
    tan: t(r.TAN),
    assessmentYear: ay?.name ?? '',
    period: { start: fy?.start ?? '', end: fy?.end ?? '' },
    salary: num(r.SALARY),
    breakup: { hra: num(sb?.hra), conveyance: num(sb?.conv), medical: num(sb?.med), telephone: num(sb?.tel), professionalTax: num(sb?.pt) },
    quarters,
  };
}

const NIL = 'NIL';

/** The two pages of CI's Form_16 layout. */
export function renderForm16(d: Form16DocumentData): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const MARGIN = 36;
  const margin = { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN };
  const width = doc.internal.pageSize.getWidth() - 2 * MARGIN;
  const styles = { font: 'times', fontSize: 8, cellPadding: 2.5, lineColor: 0, lineWidth: 0.5, textColor: 0, valign: 'middle' as const };
  const bold = { fontStyle: 'bold' as const };
  const italic = { fontStyle: 'italic' as const };
  const centre = { halign: 'center' as const };
  const grey = { fillColor: [137, 143, 144] as [number, number, number] };
  const last = () => (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const pct = (...p: number[]) => Object.fromEntries(p.map((v, i) => [i, { cellWidth: (width * v) / 100 }]));
  const table = (body: RowInput[], widths: number[], startY?: number) =>
    autoTable(doc, { startY: startY ?? last(), margin, theme: 'grid', styles, columnStyles: pct(...widths), body, rowPageBreak: 'avoid' });
  const b = (content: string, extra: object = {}): CellInput => ({ content, styles: { ...bold, ...extra } });
  const totals = form16Totals(d);
  const a = d.address;

  // ---------------------------------------------------------------- Part A
  table([
    [b('FORM NO. 16', { ...centre, fontSize: 13 })],
    [{ content: '[See rule 31(1)(a)]', styles: centre }],
    [b('Certificate under section 203 of the Income-tax Act, 1961 for tax deducted at source on salary', centre)],
  ], [100], MARGIN);
  table([
    [b('Certificate No.'), b('Last updated on')],
    [b('Name and address of the Employer'), b('Name and address of the Employee')],
    [
      [d.brand.name, d.brand.address].filter(Boolean).join('\n'),
      [d.employee.name, [a.line1, a.line2].join(','), [a.line3, a.city].join(','), a.postalCode, a.country].join('\n'),
    ],
  ], [50, 50]);
  table([
    [b('PAN of the Deductor', centre), b('TAN of the Deductor', centre), b('PAN of the Employee', centre), b('Employee Reference No. provided by the Employer (If available)', centre)],
    [{ content: d.pan, styles: centre }, { content: d.tan, styles: centre }, { content: d.employee.pan, styles: centre }, ''],
  ], [30, 30, 20, 20]);
  table([
    [b('CIT (TDS)', centre), b('Assessment Year'), { content: 'Period with the Employer', colSpan: 2, styles: bold }],
    [{ content: d.brand.cit, styles: centre }, b(d.assessmentYear), `From\n${d.period.start}`, `To\n${d.period.end}`],
  ], [45, 25, 15, 15]);
  table([
    [{ content: 'Summary of amount paid/credited and tax deducted at source thereon in respect of the employee', colSpan: 4, styles: { ...bold, ...centre } }],
    [b('Quarter(s)'), b('Receipt Numbers of original quarterly statements of TDS under sub-section (3) of Section 200'), b('Amount Paid /Credited'), b('Amount of tax deducted (Rs.)')],
    ...d.quarters.map((q) => [q.quarter, q.receiptNo, rs(q.amount), rs(q.amountTax)]),
    [b('Total'), { content: '', styles: grey }, rs(totals.amount), rs(totals.tax)],
  ], [25, 25, 25, 25]);
  const twoRows = (content: string): CellInput => ({ content, rowSpan: 2, styles: bold });
  const heading = (title: string): RowInput => [{
    content: `${title}\n(The deductor to provide payment wise details of tax deducted and deposited with respect to the deductee)`,
    colSpan: 6, styles: centre,
  }];
  table([
    heading('I. DETAILS OF TAX DEDUCTED AND DEPOSITED IN THE CENTRAL GOVERNMENT ACCOUNT THROUGH BOOK ADJUSTMENT'),
    [twoRows('Sl. No.'), twoRows('Tax Deposited in respect of the deductee (Rs.)'), { content: 'Book Identification Number (BIN)', colSpan: 4, styles: { ...bold, ...centre } }],
    [b('Receipt Numbers of Form No. 24G'), b('DDO serial number in Form no. 24G'), b('Date of transfer voucher (yyyy/mm/dd)'), b('Status of matching with Form no. 24G')],
    ['', '', { content: '', colSpan: 4, styles: grey }],
    heading('II. DETAILS OF TAX DEDUCTED AND DEPOSITED IN THE CENTRAL GOVERNMENT ACCOUNT THROUGH CHALLAN'),
    [twoRows('Sl. No.'), twoRows('Tax Deposited in respect of the deductee (Rs.)'), { content: 'Challan Identification Number (CIN)', colSpan: 4, styles: { ...bold, ...centre } }],
    [b('BSR Code of the Bank Branch'), b('Date on which Tax deposited (yyyy/mm/dd)'), b('Challan Serial Number'), b('Status of matching with OLTAS')],
    ...d.quarters.map((q, i) => [String(i + 1), rs(q.amountTax), q.bsrCode, q.taxDate, q.challanNo, q.oltas]),
    [b('Total'), rs(totals.tax), { content: '', colSpan: 4, styles: grey }],
  ], [20, 20, 15, 15, 15, 15]);
  table([
    [{ content: 'Verification', colSpan: 2, styles: { ...bold, ...centre } }],
    [{
      content: `I,...., son / daughter of..... working in the capacity of ...... (designation) do hereby certify that a sum of RS. ${rs(totals.tax)} has been deducted and a sum of RS. ${rs(totals.tax)} has been deposited to the credit of the Central Government. I further certify that the information given above is true, complete and correct and is based on the books of account, documents, TDS statements, TDS deposited and other available records.`,
      colSpan: 2,
    }],
    ['Place..............................', '(Signature of person responsible for deduction of tax)'],
    ['Date..............................', 'Full Name : ..............................'],
  ], [60, 40], last() + 6);

  // ---------------------------------------------------------------- Part B (Annexure)
  doc.addPage('a4', 'portrait');
  table([
    [{ content: 'PART B(Annexure)', colSpan: 5, styles: { ...bold, ...centre, fontSize: 13 } }],
    [b('Deductor Name'), d.brand.name, { content: `TAN : ${d.tan}`, styles: {} }, { content: 'Period', colSpan: 2, styles: bold }],
    [b('Employee'), d.employee.name, `Emp.PAN : ${d.employee.pan}`, d.period.start, d.period.end],
    [b('Employee Ref. No'), d.employee.code, b('Assessment Year'), { content: d.assessmentYear, colSpan: 2 }],
  ], [15, 30, 25, 15, 15], MARGIN);
  autoTable(doc, {
    startY: last() + 4, margin, theme: 'plain', styles: { ...styles, lineWidth: 0 },
    body: [[b('Details of Salary paid and any other income and tax deducted')]],
  });
  const line = (no: string, text: CellInput, c1: CellInput = '', c2: CellInput = '', c3: CellInput = ''): RowInput => [no, text, c1, c2, c3];
  const across = (no: string, text: string, style: object = {}): RowInput => [no, { content: text, colSpan: 4, styles: style }];
  table([
    line('1.', 'Gross Salary'),
    line('(a)', 'Salary as per provisions contained in section 17(1)', rs(d.salary)),
    line('(b)', 'Value of perquisites under section 17(2) (as per Form No. 12BA, wherever applicable)', NIL),
    line('(c)', 'Profits in lieu of salary under section 17(3) (as per Form No. 12BA, wherever applicable)', NIL),
    line('(d)', 'Total', '', b(rs(d.salary))),
    across('2.', 'Less: Allowances to the extent exempt under section 10', italic),
    line('', { content: 'Allowance', styles: centre }),
    line('(a)', 'House Rent Allowance', rs(d.breakup.hra)),
    line('(b)', 'Conveyance allowance', rs(d.breakup.conveyance)),
    line('(c)', 'Medical Allowance', rs(d.breakup.medical)),
    line('(d)', 'Telephone allowance', rs(d.breakup.telephone)),
    line('(e)', 'Special allowance', NIL),
    line('', 'Total', b(rs(totals.allowance))),
    line('3.', 'Balance(1-2)', '', b(rs(totals.balance))),
    across('4.', 'Less: Deductions under section 16', italic),
    line('(a)', 'Entertainment allowance', NIL),
    line('(b)', 'Tax on employment', rs(d.breakup.professionalTax)),
    line('5.', 'Aggregate of 4(a) and (b)', '', b(rs(d.breakup.professionalTax))),
    line('6.', 'Income chargeable under the head salaries (3-5)', '', '', b(rs(totals.chargeable))),
    across('7.', 'Add: Any other income reported by the employee'),
    line('', { content: 'Income', styles: centre }, '', 'Gross Amount', 'Qualifying AMT'),
    line('(a)', 'Any Other Income', '', NIL),
    line('(b)', 'Total', '', NIL),
    line('8.', 'Gross total income (6+7)', '', '', b(rs(totals.chargeable))),
    across('9.', 'Deductions under Chapter VI-A', italic),
    line('', 'Sections 80C, 80CCC and 80CCD(1)', '', 'Gross Amount', 'Deductible Amount'),
    line('(a)', 'Section 80C', '', NIL, NIL),
    line('', ''),
    line('(b)', 'Other sections (e.g. 80E, 80G etc.) under Chapter VI-A.', 'Gross Amount', 'Qualifying Amount', 'Deductible Amount'),
    line('', ''),
    line('10.', 'Aggregate of deductible amount under Chapter VIA', '', '', NIL),
    line('11.', 'Total Income (8-10)', '', '', `Rs. ${rs(totals.chargeable)}`),
    line('12.', 'Tax on total income (After Rebate u/s 87A)', '', '', NIL),
    line('13.', 'Surcharge', '', '', NIL),
    line('14.', 'Education cess @ 3% (on tax computed at S. No. 12)', '', '', NIL),
    line('15.', 'Tax Payable (12+13+14)', '', '', NIL),
    line('16.', 'Less: Relief under section 89 (attach details)', '', '', NIL),
    line('17.', 'Tax payable (15-16)', '', '', NIL),
  ], [5, 50, 15, 15, 15], last() + 2);
  table([
    [{ content: 'Verification', colSpan: 4, styles: { ...bold, ...italic, ...centre } }],
    [{
      content: 'I ..... son of ...... working in the capacity of ..... (designation) do hereby certify that the information given above is true, complete and correct and is based on the books of account, documents, TDS statements, TDS deposited and other available records.',
      colSpan: 4,
    }],
    [{ content: 'Place..............................', colSpan: 2 }, { content: '(Signature of person responsible for deduction of tax)', colSpan: 2 }],
    [{ content: 'Date..............................', colSpan: 2 }, { content: 'Full Name : ..............................', colSpan: 2 }],
    [b('Emp. Ref'), b('Employee Name'), b('PAN:'), b('Asst. Year:')],
    [d.employee.code, d.employee.name, d.employee.pan, d.assessmentYear],
  ], [15, 55, 15, 15]);
  return doc;
}

export const form16DocumentService = {
  /** CI previewForm16($id) (inline) / generateForm16($id) (download). `query`: the form's Period / Financial Period. */
  async render(subject: RequestSubject, rawId: string, query: { period?: string; fy?: string } = {}): Promise<{ name: string; data: Buffer }> {
    const data = await form16DocumentData(subject, rawId, query);
    const doc = renderForm16(data);
    doc.setProperties({ title: `Form 16 - ${data.employee.name}`, author: data.brand.name || 'Global HR', creator: 'Global HR' });
    return { name: `Form16_${fileSafe(data.employee.code || data.employee.name)}_${data.id}.pdf`, data: Buffer.from(doc.output('arraybuffer')) };
  },
};

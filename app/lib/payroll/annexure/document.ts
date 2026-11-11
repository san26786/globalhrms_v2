import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { SqlBuilder } from '@/lib/employeeMngt/empList';
import { brandAddress, brandContact, letterhead, type LetterheadBrand } from '@/lib/employeeMngt/exitDocuments';
import { fullName, scopeSql } from '@/lib/employeeMngt/hub/hubEngine';
import { NotFoundError } from '@/lib/http/errors';
import { getMasterIds } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { annexureType, resolvePair } from './pair';

/**
 * CI emp_sal_component_mst show_preview / downloadPaySlip / generatePdf of an annexure (common_helper
 * generateAnnexureTemplateCombined): the annexure as a PDF — the yearly and the pay-frequency amount of each
 * component, grouped as Fixed / Variable / Constant / Contribution, between Cost To Company and Gross.
 *
 * Behaviour changes: rendered from the stored rows on every request (CI wrote a file once, on the yearly header
 * only, and served it by id to anyone, logged in or not); only to users with the menu of Annexure Processing or My
 * Annexures, for annexures in their scope; the brand letterhead and dd.mm.yyyy dates; the second column is matched
 * by component (CI matched by position, and its Contribution column read a stale index); a contribution is printed
 * once (CI repeated it when it also had a calculation type).
 */
const MENUS = ['employeeMngt/emp_sal_component_mst/indexAnnexures', 'employeeMngt/emp_sal_component_mst/annexures'];
const MARGIN = 50;

interface Header {
  id: number;
  frequency: string;
  total: string | null;
  effective: string | null;
  month: string | null;
  year: string | null;
}

interface Item {
  header: number;
  component: number;
  name: string;
  amount: string | null;
  calcType: number | null;
  componentType: number | null;
  sequence: number | null;
  sc: number | null;
}

const money = (v: string | null | undefined) => (v === null || v === undefined || v === '' ? '' : Number(v).toFixed(2));
const ddmmyyyy = (d: string | null) => (d ? d.split('-').reverse().join('.') : '');
const fileSafe = (v: string) => v.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'employee';

async function documentData(subject: RequestSubject, rawId: string) {
  const allowed = await Promise.all(MENUS.map((m) => menuPolicy(m).check(subject, 'list')));
  const id = Number(rawId);
  if (!allowed.some(Boolean) || !Number.isInteger(id) || id <= 0) throw new NotFoundError('Record not found.');
  const sql = new SqlBuilder();
  const scope = await scopeSql(subject, sql);
  const [emp] = await prisma.$queryRawUnsafe<Array<{ emp: number; code: string | null; name: string; brand: number; brand_name: string; logo: string | null; brand_address: string | null; brand_contact: string | null }>>(
    `SELECT em."EMP_ID" AS emp, em."EMP_NBR" AS code, ${fullName('em')} AS name, b."OA_BRAND_ID" AS brand, b."OA_BRAND_NM" AS brand_name,
       b."OA_BRAND_LOGO" AS logo, ${brandAddress} AS brand_address, ${brandContact} AS brand_contact
     FROM emp_basic_sal_mst t JOIN emp_mst em ON em."EMP_ID" = t."EMP_ID" JOIN oa_brands b ON b."OA_BRAND_ID" = em."OA_BRAND_ID"
     WHERE t."EMP_SAL_ID" = ${sql.p(id)}::int AND t."SAL_TYPE" = ${sql.p(await annexureType())}::int AND t."IS_DELETED" = 0 AND em."IS_DELETED" = 0 AND ${scope}`,
    ...sql.params,
  );
  if (!emp) throw new NotFoundError('Record not found.');
  const pair = (await resolvePair(prisma, id))!;
  const order = [pair.yearly, pair.period].filter((v): v is number => v !== null);

  const headers = await prisma.$queryRaw<Array<Header & { id: number }>>`
    SELECT t."EMP_SAL_ID" AS id, COALESCE((SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = t."PAY_FREQUENCY_ID" LIMIT 1), '') AS frequency,
      t."ACTUAL_AMOUNT"::text AS total, to_char(t."EFFECTIVE_DATE", 'YYYY-MM-DD') AS effective, t."MONTH" AS month, t."YEAR" AS year
    FROM emp_basic_sal_mst t WHERE t."EMP_SAL_ID" = ANY(${order}::int[])`;
  const codes = await getMasterIds(['SCBS', 'PCCTF', 'PCCTV', 'PCCTC', 'CMPTC']);
  const items = await prisma.$queryRaw<Item[]>`
    SELECT DISTINCT ON (d."EMP_BASIC_SAL_DTL_ID") d."SAL_MST_ID" AS header, d."SAL_COMP_ID" AS component,
      COALESCE((SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = d."SAL_COMP_ID" LIMIT 1), '') AS name,
      d."ACTUAL_AMOUNT"::text AS amount, s."PAYROLL_COMP_CALC_TYPE" AS "calcType", s."COMPONENT_TYPE" AS "componentType",
      s."COMPONENT_SEQUENCE" AS sequence, s."SC_ID" AS sc
    FROM emp_basic_sal_dtl d
    LEFT JOIN salary_component_settings s ON s."COMPONENT_ID" = d."SAL_COMP_ID" AND s."OA_BRAND_ID" = d."OA_BRAND_ID"
      AND s."IS_DELETED" = 0 AND s."IS_ENABLED" = 1 AND s."VISIBLE_IN_ANNEXURE" = 1
    WHERE d."SAL_MST_ID" = ANY(${order}::int[]) AND d."IS_DELETED" = 0
    ORDER BY d."EMP_BASIC_SAL_DTL_ID", s."SC_ID"`;
  const brand: LetterheadBrand = { id: Number(emp.brand), name: emp.brand_name, logo: emp.logo, address: emp.brand_address, contact: emp.brand_contact };
  return {
    employee: { id: Number(emp.emp), code: emp.code, name: emp.name },
    brand,
    headers: order.map((h) => headers.find((x) => Number(x.id) === h)!).filter(Boolean),
    items: items.map((i) => ({ ...i, header: Number(i.header), component: Number(i.component) })),
    codes,
  };
}

type Data = Awaited<ReturnType<typeof documentData>>;

/** The groups and their lines (yearly / period amount by component), in the brand's component sequence. */
function groups(data: Data): Array<{ title: string; lines: Array<{ name: string; amounts: string[] }> }> {
  const { codes, headers, items } = data;
  const amountOf = (component: number) => headers.map((h) => money(items.find((i) => i.header === h.id && i.component === component)?.amount));
  const unique = new Map<number, Item>();
  for (const i of items) if (!unique.has(i.component) || (unique.get(i.component)!.sc === null && i.sc !== null)) unique.set(i.component, i);
  const sorted = [...unique.values()].sort((a, b) => (a.sequence ?? 1e9) - (b.sequence ?? 1e9) || (a.sc ?? 1e9) - (b.sc ?? 1e9));
  const printed = new Set<number>();
  const take = (match: (i: Item) => boolean) =>
    sorted.filter((i) => i.sc !== null && !printed.has(i.component) && match(i)).map((i) => {
      printed.add(i.component);
      return { name: i.name, amounts: amountOf(i.component) };
    });
  const contribution = take((i) => i.componentType === codes.CMPTC);
  const basic = unique.has(codes.SCBS ?? -1) ? [{ name: unique.get(codes.SCBS!)!.name, amounts: amountOf(codes.SCBS!) }] : [];
  if (basic.length) printed.add(codes.SCBS!);
  return [
    { title: 'Fixed Components', lines: [...basic, ...take((i) => i.calcType === codes.PCCTF)] },
    { title: 'Variable Components', lines: take((i) => i.calcType === codes.PCCTV) },
    { title: 'Constant Components', lines: take((i) => i.calcType === codes.PCCTC) },
    { title: 'Contribution', lines: contribution },
  ].filter((g) => g.lines.length);
}

async function render(data: Data): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = await letterhead(doc, data.brand);
  const first = data.headers[0];
  doc.setFont('times', 'bold').setFontSize(12).text('Annexure *', MARGIN, y);
  y += 16;
  doc.text(`W.e.f - ${ddmmyyyy(first?.effective ?? null)}`, MARGIN, y);
  y += 12;

  const cols = data.headers.length;
  const bold = { fontStyle: 'bold' as const, halign: 'center' as const };
  const right = { halign: 'right' as const };
  const totals = data.headers.map((h) => ({ content: money(h.total), styles: { ...right, fontStyle: 'bold' as const } }));
  const body: RowInput[] = [
    ['ID', { content: data.employee.code ?? String(data.employee.id), colSpan: 1 + cols }],
    ['Name', { content: data.employee.name, colSpan: 1 + cols }],
    [{ content: 'Components Heads', colSpan: 2, styles: bold }, ...data.headers.map((h) => ({ content: `${h.frequency} Amount`, styles: bold }))],
    [{ content: 'Cost To Company', colSpan: 2, styles: bold }, ...totals],
  ];
  for (const g of groups(data)) {
    g.lines.forEach((line, i) => {
      body.push([
        ...(i === 0 ? [{ content: g.title, rowSpan: g.lines.length, styles: { ...bold, valign: 'middle' as const } }] : []),
        line.name,
        ...line.amounts.map((a) => ({ content: a, styles: right })),
      ]);
    });
  }
  body.push([{ content: 'Gross', colSpan: 2, styles: bold }, ...totals]);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, bottom: 60 },
    theme: 'grid',
    styles: { font: 'times', fontSize: 10, cellPadding: 4, lineColor: 60, lineWidth: 0.5, textColor: 20 },
    columnStyles: { 0: { cellWidth: 110 } },
    body,
  });
  const end = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  doc.setFont('times', 'bold').setFontSize(10).text('*Annexure is subject to change as per company policies', MARGIN, end);
  return doc;
}

export const annexureDocumentService = {
  /** The annexure PDF of the pair the header `id` belongs to. */
  async render(subject: RequestSubject, id: string): Promise<{ name: string; data: Buffer }> {
    const data = await documentData(subject, id);
    const doc = await render(data);
    doc.setProperties({ title: `Annexure - ${data.employee.name}`, author: data.brand.name, creator: 'Global HR' });
    const h = data.headers[0];
    const period = h?.month && h?.year ? `_${String(h.month).trim().padStart(2, '0')}-${String(h.year).trim()}` : '';
    return { name: `Annexure_${fileSafe(data.employee.code ?? String(data.employee.id))}${period}.pdf`, data: Buffer.from(doc.output('arraybuffer')) };
  },
};

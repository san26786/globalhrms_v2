import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { employeeAddressSql } from './hub/screens/empContactAddress';
import { EXIT_STEPS, type ExitStep } from './hub/defs/exit_clearance';
import { asId, fullName, isoDate, masterName } from './hub/hubEngine';
import { HUB_SCREENS } from './hub/hubTypes';
import { hubFor } from './hub/registry';
import { itemValueSql } from './hub/screens/exit_clearance';
import { EMAIL_EXPR, PHONE_EXPR } from './empList';
import { latestExitSql, separationDateSql } from './termination';

/**
 * CI department_activity/human_resource::generateExitForm / previewExitForm / generateRelievingOrder /
 * generateExperienceLetter and department_head_supervisor::download* (common_helper exitClearanceFormTemplate,
 * relievingOrder*Template, experienceLetter*Template): the exit clearance's three PDFs.
 *
 * As CI: the Exit Form Setting of the employee's brand must exist (its four instruction lines head the exit
 * form); "Generate" marks the clearance generated (IS_GENERATED), after which the list offers the exit
 * form, relieving order and experience letter; only admins generate. Behaviour changes: the PDFs are built
 * from the current records on every download (CI wrote files under exit_form/ … and served a stale or
 * missing one); the brand is the employee's (CI used the session's); CI's three letter templates differed
 * only in their header art, so there is one layout (brand logo and name, brand address in the footer);
 * the letters are signed "HR Manager, <brand>" (CI printed one company's HR manager for every customer);
 * the relieving order quotes the resignation date (CI left "dated" blank) and the experience letter gives
 * the job title and the service period (CI: the department, "till Date"); "Whomsoever" is spelled right.
 */
export const EXIT_DOCUMENTS = {
  'exit-form': 'Exit Clearance Form',
  'relieving-order': 'Relieving Order',
  'experience-letter': 'Experience Letter',
} as const;
export type ExitDocument = keyof typeof EXIT_DOCUMENTS;
export const isExitDocument = (v: string): v is ExitDocument => Object.prototype.hasOwnProperty.call(EXIT_DOCUMENTS, v);

const MENU = HUB_SCREENS.exit_clearance.menu;
const [DH] = EXIT_STEPS;

type Text = string | null;

interface ExitData {
  employee: {
    id: number; code: Text; name: string; title: Text; department: Text; joined: Text; separated: Text; resigned: Text;
    address: Text; phone: Text; email: Text; male: boolean;
  };
  brand: { id: number; name: string; logo: Text; address: Text; contact: Text };
  instructions: string[];
  /** Each department's item values by column (missing department: empty). */
  steps: Map<string, Record<string, Text>>;
  appraisal: Text;
  ktPlan: Text;
  handover: Text;
  generated: boolean;
}

const brandAddress = `NULLIF(concat_ws(', ', NULLIF(btrim(b."ADDRESS_ONE"), ''), NULLIF(btrim(b."ADDRESS_TWO"), ''), NULLIF(btrim(b."CITY"), ''),
  NULLIF(btrim(b."STATE"), ''), ${masterName('b."country"')}), '')`;
const brandContact = `NULLIF(concat_ws('  |  ', 'Tel: ' || NULLIF(btrim(b."TELEPHONE"), ''), 'Email: ' || NULLIF(btrim(b."EMAIL"), ''),
  CASE WHEN b."WEBSITE" LIKE '%.%' THEN btrim(b."WEBSITE") END), '')`;
const latestJob = (column: string) => `(SELECT j."${column}" FROM job_mst j WHERE j."EMP_ID" = em."EMP_ID" AND j."IS_DELETED" = 0 ORDER BY j."JOB_ID" DESC LIMIT 1)`;

async function stepValues(step: ExitStep, employeeId: number): Promise<Record<string, Text>> {
  const [row] = await prisma.$queryRawUnsafe<Array<Record<string, Text>>>(
    `SELECT ${step.items.map((i) => `${itemValueSql(i)} AS "${i.column}"`).join(', ')} FROM ${step.table} t
     WHERE t."EMP_ID" = $1::integer AND t."IS_DELETED" = 0 ORDER BY t."${step.pk}" DESC LIMIT 1`,
    employeeId,
  );
  return row ?? {};
}

/** CI exitFormPdfData: the clearance `id` (in the caller's scope) and everything the PDFs print. */
async function exitData(subject: RequestSubject, id: string): Promise<ExitData> {
  const employeeId = Number((await hubFor('exit_clearance').get(subject, id)).EMP_ID);
  const [row] = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT em."EMP_NBR" AS code, ${fullName('em')} AS name, ${masterName(latestJob('JOB_TITLE_ID'))} AS title,
       ${masterName(latestJob('DEPARTMENT_ID'))} AS department, ${isoDate(latestJob('DATE_OF_JOINING'))} AS joined,
       ${separationDateSql('em')} AS separated, ${isoDate(latestExitSql('em', 'RESIGNED_ON'))} AS resigned,
       ${employeeAddressSql('em')} AS address, ${EMAIL_EXPR} AS email,
       NULLIF(btrim(COALESCE(${masterName(asId('em."COUNTRY_CODE"'))}, '') || ' ' || COALESCE(${PHONE_EXPR}, '')), '') AS phone,
       lower(btrim(COALESCE(${masterName('em."GENDER_ID"')}, ''))) = 'male' AS male,
       b."OA_BRAND_ID" AS brand, b."OA_BRAND_NM" AS brand_name, b."OA_BRAND_LOGO" AS logo,
       ${brandAddress} AS brand_address, ${brandContact} AS brand_contact,
       ${isoDate(`CASE WHEN d."APPARAISAL_COMPLETED_REMARKS" > DATE '1971-01-01' THEN d."APPARAISAL_COMPLETED_REMARKS" END`)} AS appraisal,
       NULLIF(btrim(d."KT_PLAN_ATTECHMENT"), '') AS kt_plan, d."IS_GENERATED" = 1 AS generated,
       (SELECT ${fullName('h')} FROM emp_mst h WHERE h."EMP_ID" = ${asId('d."CHARGE_HANDOVER_TO_REMARKS"')} LIMIT 1) AS handover,
       s."INSTRUCTION_LINE_1" AS i1, s."INSTRUCTION_LINE_2" AS i2, s."INSTRUCTION_LINE_3" AS i3, s."INSTRUCTION_LINE_4" AS i4,
       s."EXIT_FORM_SETTING_ID" IS NOT NULL AS has_settings
     FROM ${DH.table} d
     JOIN emp_mst em ON em."EMP_ID" = d."EMP_ID"
     JOIN oa_brands b ON b."OA_BRAND_ID" = em."OA_BRAND_ID"
     LEFT JOIN LATERAL (SELECT * FROM exit_form_setting x WHERE x."OA_BRAND_ID" = em."OA_BRAND_ID" ORDER BY x."EXIT_FORM_SETTING_ID" LIMIT 1) s ON TRUE
     WHERE d."${DH.pk}" = $1::integer AND d."IS_DELETED" = 0`,
    Number(id),
  );
  if (!row) throw new NotFoundError('Record not found.');
  if (!row.has_settings) throw new BusinessRuleError('Please update the Exit Form Settings of the employee\'s brand first.');

  const t = (v: unknown): Text => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const steps = new Map<string, Record<string, Text>>();
  for (const step of EXIT_STEPS) steps.set(step.key, await stepValues(step, employeeId));
  return {
    employee: {
      id: employeeId, code: t(row.code), name: t(row.name) ?? '', title: t(row.title), department: t(row.department), joined: t(row.joined),
      separated: t(row.separated), resigned: t(row.resigned), address: t(row.address), phone: t(row.phone), email: t(row.email), male: row.male === true,
    },
    brand: { id: Number(row.brand), name: t(row.brand_name) ?? '', logo: t(row.logo), address: t(row.brand_address), contact: t(row.brand_contact) },
    instructions: [row.i1, row.i2, row.i3, row.i4].map(t).filter((v): v is string => !!v),
    steps,
    appraisal: t(row.appraisal),
    ktPlan: t(row.kt_plan),
    handover: t(row.handover),
    generated: row.generated === true,
  };
}

// ------------------------------------------------------------------ rendering

const MARGIN = 50;
const ddmmyyyy = (d: Text) => (d ? d.split('-').reverse().join('-') : '');
const ORDINAL = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** CI date("dS F Y"): 05th March 2024. */
const longDate = (d: Text) => {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return `${String(day).padStart(2, '0')}${ORDINAL(day)} ${MONTHS[m - 1]} ${y}`;
};

async function logoImage(logo: Text): Promise<{ data: Uint8Array; format: 'PNG' | 'JPEG' } | null> {
  const dir = process.env.ORG_LOGO_DIR?.trim();
  if (!dir || !logo) return null;
  const file = path.basename(logo);
  const ext = path.extname(file).toLowerCase();
  const format = ext === '.png' ? 'PNG' : ext === '.jpg' || ext === '.jpeg' ? 'JPEG' : null;
  if (!format) return null;
  try {
    return { data: new Uint8Array(await readFile(path.join(dir, file))), format };
  } catch {
    return null;
  }
}

/** The letterhead: logo and brand name on top, the brand's address and contacts at the foot. */
async function letterhead(doc: jsPDF, brand: ExitData['brand']): Promise<number> {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const logo = await logoImage(brand.logo);
  let y = 40;
  if (logo) {
    try {
      const props = doc.getImageProperties(logo.data);
      const h = 45;
      const w = Math.min(160, (props.width / props.height) * h);
      doc.addImage(logo.data, logo.format, MARGIN, y, w, h);
    } catch {
      // An unreadable logo leaves the brand name alone.
    }
  }
  doc.setFont('times', 'bold').setFontSize(16).text(brand.name, width - MARGIN, y + 28, { align: 'right' });
  y += 55;
  doc.setLineWidth(0.8).line(MARGIN, y, width - MARGIN, y);

  doc.setFont('times', 'normal').setFontSize(8);
  const foot = [brand.address, brand.contact].filter((v): v is string => !!v);
  doc.line(MARGIN, height - 50, width - MARGIN, height - 50);
  foot.forEach((line, i) => doc.text(line, width / 2, height - 38 + i * 10, { align: 'center', maxWidth: width - 2 * MARGIN }));
  return y + 25;
}

function paragraphs(doc: jsPDF, startY: number, lines: Array<{ text: string; bold?: boolean; center?: boolean; size?: number; gap?: number }>): number {
  const width = doc.internal.pageSize.getWidth();
  let y = startY;
  for (const l of lines) {
    doc.setFont('times', l.bold ? 'bold' : 'normal').setFontSize(l.size ?? 11);
    const wrapped = doc.splitTextToSize(l.text, width - 2 * MARGIN) as string[];
    doc.text(wrapped, l.center ? width / 2 : MARGIN, y, { align: l.center ? 'center' : 'left' });
    y += wrapped.length * (l.size ?? 11) * 1.3 + (l.gap ?? 8);
  }
  return y;
}

async function letter(data: ExitData, heading: string, body: string[]): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  let y = await letterhead(doc, data.brand);
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  doc.setFont('times', 'normal').setFontSize(11);
  doc.text(`Ref : ${data.employee.code ?? ''}`, MARGIN, y);
  doc.text(`Date : ${ddmmyyyy(todayIso)}`, width - MARGIN, y, { align: 'right' });
  y += 30;
  y = paragraphs(doc, y, [
    { text: data.employee.name, bold: true, gap: 2 },
    ...(data.employee.address ? [{ text: data.employee.address, gap: 20 }] : [{ text: '', gap: 12 }]),
    { text: heading, bold: true, center: true, size: 16, gap: 18 },
    { text: `Dear ${data.employee.name},` },
    ...body.map((text) => ({ text })),
    { text: 'Yours sincerely,', gap: 50 },
  ]);
  paragraphs(doc, y, [{ text: 'HR Manager', gap: 0 }, { text: data.brand.name }]);
  return doc;
}

function experienceLetter(data: ExitData): Promise<jsPDF> {
  const e = data.employee;
  const [him, his] = e.male ? ['him', 'his'] : ['her', 'her'];
  const role = e.title ?? e.department;
  const period = e.joined ? ` from ${longDate(e.joined)} ${e.separated ? `to ${longDate(e.separated)}` : 'till date'}` : '';
  return letter(data, 'To Whomsoever It May Concern', [
    `This is to certify that ${e.name} worked at ${data.brand.name}${role ? ` as ${role}` : ''}${period}.`,
    `During ${his} tenure, we found ${him} to be honest, sincere and very intelligent. ${his[0].toUpperCase()}${his.slice(1)} services were found to be satisfactory.`,
    `We wish ${him} all the best in ${his} future endeavors.`,
  ]);
}

function relievingOrder(data: ExitData): Promise<jsPDF> {
  const e = data.employee;
  return letter(data, 'Relieving Order', [
    `This has reference to your resignation letter${e.resigned ? ` dated ${longDate(e.resigned)}` : ''}. This is to inform you that your resignation has been accepted and you are relieved from the services of ${data.brand.name}${e.separated ? ` on the close of working hours on ${longDate(e.separated)}` : ''}.`,
    'You are requested to deposit the company ID and any other company property entrusted to you during your employment with us.',
    'We wish you all success in your future endeavours.',
  ]);
}

async function exitForm(data: ExitData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const e = data.employee;
  let y = await letterhead(doc, data.brand);
  y = paragraphs(doc, y, [{ text: 'Exit Clearance Form', bold: true, center: true, size: 15, gap: 12 }]);
  if (data.instructions.length) {
    y = paragraphs(doc, y, [{ text: 'Instructions:', bold: true, gap: 4 }, ...data.instructions.map((text) => ({ text: `•  ${text}`, gap: 3 }))]);
  }
  y = paragraphs(doc, y + 8, [{ text: 'Employee Details', bold: true, gap: 0 }]);

  const cell = { font: 'times', fontSize: 9.5, cellPadding: 4, lineColor: 60, lineWidth: 0.5, textColor: 20 } as const;
  autoTable(doc, {
    startY: y - 4,
    margin: { left: MARGIN, right: MARGIN, bottom: 60 },
    theme: 'grid',
    styles: cell,
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 95 }, 2: { fontStyle: 'bold', cellWidth: 95 } },
    body: [
      ['Employee Name', e.name, 'Employee ID', e.code ?? ''],
      ['Title', e.title ?? '', 'Department', e.department ?? ''],
      ['Date of Joining', ddmmyyyy(e.joined), 'Date of Separation', ddmmyyyy(e.separated)],
      ['Correspondence Address', e.address ?? '', 'Permanent Address', e.address ?? ''],
      ['Res. Phone Number', e.phone ?? '', 'Mobile Number', e.phone ?? ''],
      ['Personal Email ID', e.email ?? '', 'Alternate Email ID', e.email ?? ''],
    ],
  });

  const value = (key: string, column: string) => data.steps.get(key)?.[column] ?? '';
  const section = (title: string) => [{ content: title, colSpan: 3, styles: { fontStyle: 'bold' as const, fillColor: 235 } }];
  const rows: Array<Array<string | ReturnType<typeof section>[number]>> = [];
  for (const step of EXIT_STEPS) {
    rows.push(section(step.key === 'exit_clearance' ? 'Department Head/ Supervisor' : HUB_SCREENS[step.key].title));
    if (step.key === 'exit_clearance') {
      rows.push(['Appraisal Completed Date', '', ddmmyyyy(data.appraisal)]);
      rows.push([step.items[0].label, '', value(step.key, step.items[0].column)]);
      rows.push(['KT Plan Attachment', '', data.ktPlan ?? '']);
      rows.push(['Charge Handover to', '', data.handover ?? '']);
      for (const i of step.items.slice(1)) rows.push([i.label, '', value(step.key, i.column)]);
    } else {
      for (const i of step.items) rows.push([i.label, '', value(step.key, i.column)]);
    }
  }
  autoTable(doc, {
    startY: (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20,
    margin: { left: MARGIN, right: MARGIN, bottom: 60 },
    theme: 'grid',
    styles: cell,
    headStyles: { fillColor: 169, textColor: 0, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 210 } },
    head: [['Department and Activity', 'Name and Signature', 'Remarks']],
    body: rows,
  });
  return doc;
}

const RENDER: Record<ExitDocument, (data: ExitData) => Promise<jsPDF>> = {
  'exit-form': exitForm,
  'relieving-order': relievingOrder,
  'experience-letter': experienceLetter,
};

const fileSafe = (v: string) => v.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'employee';

export const exitDocumentService = {
  /** The PDF of the clearance `id`; the letters only once the exit form is generated (CI's list conditions). */
  async render(subject: RequestSubject, id: string, kind: ExitDocument): Promise<{ name: string; data: Buffer }> {
    const data = await exitData(subject, id);
    if (kind !== 'exit-form' && !data.generated) throw new BusinessRuleError('Generate the exit form first.');
    const doc = await RENDER[kind](data);
    doc.setProperties({ title: `${EXIT_DOCUMENTS[kind]} - ${data.employee.name}`, author: data.brand.name, creator: 'Global HR' });
    return { name: `${fileSafe(EXIT_DOCUMENTS[kind])}_${fileSafe(data.employee.code ?? String(data.employee.id))}.pdf`, data: Buffer.from(doc.output('arraybuffer')) };
  },

  /** CI generateExitForm: marks the clearance generated (admins with the menu's update grant). */
  async generate(subject: RequestSubject, id: string): Promise<{ message: string }> {
    if (subject.adminLevel === 0 || !(await menuPolicy(MENU).check(subject, 'update'))) throw new ForbiddenError();
    await exitData(subject, id); // scope + Exit Form Setting present
    await prisma.$executeRawUnsafe(
      `UPDATE ${DH.table} SET "IS_GENERATED" = 1, "UPDATED_BY" = $2::text, "UPDATED_ON" = now() WHERE "${DH.pk}" = $1::integer AND "IS_DELETED" = 0`,
      Number(id), String(subject.userId),
    );
    return { message: 'Exit form generated.' };
  },
};

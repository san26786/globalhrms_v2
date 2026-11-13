import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { BusinessRuleError, ForbiddenError, ValidationError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { settingService } from '@/lib/settings/settingService';
import { EMAIL_EXPR, PHONE_EXPR, SqlBuilder } from './empList';
import { EMP_SCREENS, type EmpScreen } from './empTypes';
import { asId, fullName, masterName } from './hub/hubEngine';
import { employeeAddressOfTypeSql } from './hub/screens/empContactAddress';

/**
 * CI employeeMngt/emp_mst toolbar reports (Employee Manager, admins): "Generate ESR CSV Report" (emp_mst/export),
 * "Generate ESR Excel Report" (export/createXLS — India — or createXLSIOM), "Generate ESR PDF Report" (emp_mst/pdf),
 * "Generate Appraisal Report" (emp_mst/appraisal), and Team Employee Manager's "Generate ESR Report" (emp_mst/export);
 * plus the list's "Update Employees with current settings" (emp_mst/updateEmployee).
 *
 * The Employee Status Report lists the brand's employees on the "As of Date" (the list's date box): joined by then and
 * not yet gone (left that month, later, or not at all); without a date, everyone not terminated. As CI: the CSV / PDF
 * and the Excel apply CI's own rules (the Excel also keeps an employee on notice whose last day is later), every empty
 * value prints "NA", dates print as 1-Apr-2019, the Excel's columns depend on the brand's country (India or not).
 *
 * Behaviour changes: admins with the screen's grant only (CI's URLs were open to anyone and took the date into the SQL);
 * the PDF has a header row and fits the page (CI printed bare values on a 1.6 m wide page under the name
 * "monthly_register"); deleted job / bank / termination / education rows are ignored; the non-India Excel's "Tax
 * Reference No" column holds the tax reference (CI printed the tax allowance type); the appraisal report covers the
 * active brand (CI: the whole organisation).
 */
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const fmt = (expr: string) => `to_char(${expr}, 'FMDD-Mon-YYYY')`;
const lastJob = (column: string) => `j."${column}"`;

export interface EsrRow {
  [key: string]: string | number | null;
}

async function authorise(subject: RequestSubject, screen: EmpScreen) {
  if (subject.adminLevel === 0 || !(await menuPolicy(EMP_SCREENS[screen].menu).check(subject, 'list'))) throw new ForbiddenError();
  const brand = subject.oaBrandId ?? null;
  if (!brand) throw new BusinessRuleError('Select a brand first.');
  return brand;
}

function asOf(raw: string | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (!DATE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new ValidationError('Validation failed.', { date: ['The As of Date must be a valid date.'] });
  return v;
}

/** One row per employee of the brand with every ESR field (CI emp_mst_vw, over the base tables). */
async function esrRows(brand: number, date: string | null, rule: 'csv' | 'excel'): Promise<EsrRow[]> {
  const sql = new SqlBuilder();
  const b = sql.p(brand);
  const conditions: string[] = [];
  if (date) {
    const d = `${sql.p(date)}::date`;
    conditions.push(`v.doj <= ${d}`);
    conditions.push(rule === 'csv'
      ? `(date_trunc('month', v.term) = date_trunc('month', ${d}) OR v.term IS NULL OR v.term > ${d})`
      : `(date_trunc('month', v.term) = date_trunc('month', ${d}) OR (v."EMPLOYMENT_STATUS" = 'Notice Period' AND v.term >= ${d}) OR v.term IS NULL)`);
  } else {
    conditions.push('v.term IS NULL');
  }
  return prisma.$queryRawUnsafe<EsrRow[]>(
    `SELECT * FROM (
       SELECT em."EMP_ID" AS id, em."EMP_NBR", ${fullName('em')} AS "EMP_FULL_NAME", em."EMP_NAME", em."EMP_MIDDLE_NM", em."EMPLST_NM",
         ${masterName(lastJob('DEPARTMENT_ID'))} AS "DEPARTMENT",
         NULLIF(btrim(${lastJob('COST_CENTER')}), '') AS "COST_CENTER",
         (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = ${asId(lastJob('COST_CENTER'))} LIMIT 1) AS "COST_CENTER_NM",
         (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" =
            (SELECT l."LOCATION_ID" FROM emp_reporting_locations l WHERE l."EMP_ID" = em."EMP_ID" AND l."IS_DELETED" = 0
             ORDER BY l."EMP_REPORTING_LOCATIONS_ID" DESC LIMIT 1) LIMIT 1) AS "LOCATION_NAME",
         ${masterName(lastJob('DESIGNATION_ID'))} AS "DESIGNATION",
         j."DATE_OF_JOINING"::date AS doj, ${fmt('j."DATE_OF_JOINING"')} AS "DATE_OF_JOINING",
         ${masterName('em."GENDER_ID"')} AS "GENDER", em."EMP_PAN_NBR", em."EMP_SSN_NBR", em."EMP_SIN_NBR", em."TAX_REF_NO",
         ${masterName(lastJob('EMP_GRADE_ID'))} AS "EMP_GRADE",
         ob."OA_BRAND_NM" AS "COMPANY_NAME",
         ${employeeAddressOfTypeSql('em', 'CATO')} AS "OFFICE_ADDRESS",
         ${EMAIL_EXPR} AS "EMAIL_ADD", em."SKYPE_ID",
         NULLIF(btrim(COALESCE(${masterName(asId('em."COUNTRY_CODE"'))}, '') || ' ' || COALESCE(${PHONE_EXPR}, '')), '') AS "FULL_PHONE_NBR",
         ${masterName(lastJob('EMP_TYPE_ID'))} AS "EMPLOYMENT_TYPE",
         ${masterName(lastJob('EMP_STATUS_ID'))} AS "EMPLOYMENT_STATUS",
         ${fmt('j."CONFIRMATION_DATE"')} AS "CONFIRMATION_DATE", ${fmt('j."LAST_APPRAISAL_DATE"')} AS "LAST_APPRAISAL_DATE",
         ${masterName(lastJob('APPRAISAL_TYPE'))} AS "APPRAISALTYPE",
         t."TERMINATION_DATE"::date AS term,
         ${fmt('t."RESIGNED_ON"')} AS "RESIGNATION_DATE", ${fmt('t."TERMINATION_DATE"')} AS "TERMINATION_DATE",
         ${masterName('t."EMP_TERMINATION_ID"')} AS "TERMINATION",
         ${employeeAddressOfTypeSql('em', 'CATH', true)} AS "RESIDENTIAL_ADDRESS",
         (SELECT e."MAJOR" FROM emp_education e WHERE e."EMP_ID" = em."EMP_ID" AND e."IS_DELETED" = 0 ORDER BY e."ID" DESC LIMIT 1) AS "EDUCATION_NAME",
         (SELECT i."IMMIGRATION_NO" FROM immigration_dtl i WHERE i."EMP_ID" = em."EMP_ID" AND i."IS_DELETED" = false
            AND i."IMMIGRATION_TYP_ID" = (SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = 'ITPS' ORDER BY im."MSTR_ID" LIMIT 1)
          ORDER BY i."IMMIGRATION_ID" DESC LIMIT 1) AS "PASSPORT_NO",
         (SELECT u."USER_NAME" FROM user_mst u WHERE u."USER_ID" = em."USER_ID" LIMIT 1) AS "USER_NM",
         ${fmt('em."DOB"')} AS "DOB", ${masterName('em."BLOOD_GRP"')} AS "BLOOD_GRP",
         bk."ACCOUNT_NO", bk."BANK_NM" AS "BANK_NAME", bk."IFSC_CD" AS "IFSC_CODE",
         j."EMP_GROSS_SALARY"::text AS "EMP_GROSS_SALARY",
         ${masterName('em."MARITAL_STATUS_ID"')} AS "MARITAL_STATUS",
         NULL::text AS "CAREERSTREAM_NM"
       FROM emp_mst em
       JOIN oa_brands ob ON ob."OA_BRAND_ID" = em."OA_BRAND_ID"
       LEFT JOIN LATERAL (SELECT * FROM job_mst x WHERE x."EMP_ID" = em."EMP_ID" AND x."IS_DELETED" = 0 ORDER BY x."JOB_ID" DESC LIMIT 1) j ON true
       LEFT JOIN LATERAL (SELECT * FROM emp_termination_dtl x WHERE x."EMP_ID" = em."EMP_ID" AND x."IS_DELETED" = 0 ORDER BY x."TERMINATION_ID" DESC LIMIT 1) t ON true
       LEFT JOIN LATERAL (SELECT x."ACCOUNT_NO", x."BANK_NM", x."IFSC_CD" FROM bank_dtl x WHERE x."EMP_ID" = em."EMP_ID" AND x."IS_PRIMARY" = 1
           AND btrim(COALESCE(x."IS_DELETED", '0'), '''') = '0' ORDER BY x."BANK_ID" DESC LIMIT 1) bk ON true
       WHERE em."IS_DELETED" = 0 AND em."OA_BRAND_ID" = ${b}::int
     ) v
     WHERE ${conditions.join(' AND ')}
     ORDER BY v."EMP_NBR", v.id`,
    ...sql.params,
  );
}

const na = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' ? 'NA' : String(v));
const today = (d = new Date()) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;
/** PHP fputcsv: quoted only when the value holds a comma, quote, space or line break. */
const fputcsvCell = (v: string) => (/[,"\s]/.test(v) ? csvCell(v) : v);

/** CI export_csv headers and fields, in order. */
const CSV_COLUMNS: Array<[string, string]> = [
  ['Employee ID', 'EMP_NBR'], ['Employee Name', 'EMP_FULL_NAME'], ['Department', 'DEPARTMENT'], ['Cost Center', 'COST_CENTER'],
  ['Location', 'LOCATION_NAME'], ['Designation', 'DESIGNATION'], ['Employee DOJ', 'DATE_OF_JOINING'], ['Gender', 'GENDER'],
  ['PAN Number', 'EMP_PAN_NBR'], ['Grade', 'EMP_GRADE'], ['Company Name', 'COMPANY_NAME'], ['Office Address', 'OFFICE_ADDRESS'],
  ['Email ID', 'EMAIL_ADD'], ['Skype ID', 'SKYPE_ID'], ['Contact Number', 'FULL_PHONE_NBR'], ['Association Type', 'EMPLOYMENT_TYPE'],
  ['Confirmation Date', 'CONFIRMATION_DATE'], ['Last Appraisal Date', 'LAST_APPRAISAL_DATE'], ['Appraisal Type', 'APPRAISALTYPE'],
  ['Resignation Date', 'RESIGNATION_DATE'], ['Employee Termination Date', 'TERMINATION_DATE'], ['Termination Reason', 'TERMINATION'],
  ['Father/Husband Name', 'EMP_MIDDLE_NM'], ['Residential Address', 'RESIDENTIAL_ADDRESS'], ['Qualification', 'EDUCATION_NAME'],
  ['Passport Number', 'PASSPORT_NO'], ['Employee DOB', 'DOB'], ['Blood Group', 'BLOOD_GRP'], ['Bank Account Number', 'ACCOUNT_NO'],
  ['Employee Bank Name', 'BANK_NAME'], ['IFSC Code', 'IFSC_CODE'], ['Aadhar Number', 'EMP_SSN_NBR'],
];

/** CI pdf() fields (it printed no header; the labels are the CSV's where the field is shared). */
const PDF_COLUMNS: Array<[string, string]> = [
  ['Employee ID', 'EMP_NBR'], ['Employee Name', 'EMP_FULL_NAME'], ['Department', 'DEPARTMENT'], ['Cost Center', 'COST_CENTER'],
  ['Location', 'LOCATION_NAME'], ['Designation', 'DESIGNATION'], ['Employee DOJ', 'DATE_OF_JOINING'], ['Gender', 'GENDER'],
  ['PAN Number', 'EMP_PAN_NBR'], ['Aadhar Number', 'EMP_SSN_NBR'], ['Grade', 'EMP_GRADE'], ['Company Name', 'COMPANY_NAME'],
  ['Office Address', 'OFFICE_ADDRESS'], ['Email ID', 'EMAIL_ADD'], ['Skype ID', 'SKYPE_ID'], ['Contact Number', 'FULL_PHONE_NBR'],
  ['Association Type', 'EMPLOYMENT_TYPE'], ['Confirmation Date', 'CONFIRMATION_DATE'], ['Last Appraisal Date', 'LAST_APPRAISAL_DATE'],
  ['Appraisal Type', 'APPRAISALTYPE'], ['Resignation Date', 'RESIGNATION_DATE'], ['Termination Date', 'TERMINATION_DATE'],
  ['Termination Reason', 'TERMINATION'], ['Father/Husband Name', 'EMP_MIDDLE_NM'], ['Residential Address', 'RESIDENTIAL_ADDRESS'],
  ['Qualification', 'EDUCATION_NAME'], ['User Name', 'USER_NM'], ['DOB', 'DOB'], ['Blood Group', 'BLOOD_GRP'], ['Account No', 'ACCOUNT_NO'],
  ['Bank Name', 'BANK_NAME'], ['IFSC Code', 'IFSC_CODE'],
];

export const empReports = {
  /** "Generate ESR CSV Report" (Employee Manager) / "Generate ESR Report" (Team Employee Manager): ESR_YYYYMMDD.csv. */
  async esrCsv(subject: RequestSubject, screen: EmpScreen, rawDate?: string) {
    const brand = await authorise(subject, screen);
    const rows = await esrRows(brand, asOf(rawDate), 'csv');
    // CI dbutil csv_from_result: every value quoted, each line ending with the delimiter.
    const line = (cells: string[]) => `${cells.map(csvCell).join(',')},`;
    const lines = [line(CSV_COLUMNS.map(([h]) => h)), ...rows.map((r) => line(CSV_COLUMNS.map(([, k]) => na(r[k]))))];
    return { name: `ESR_${today()}.csv`, data: Buffer.from(`${lines.join('\n')}\n`, 'utf8') };
  },

  /** "Generate ESR Excel Report": ESR_{As of Date}.xlsx — India's layout or the other countries' (CI createXLS / createXLSIOM). */
  async esrExcel(subject: RequestSubject, rawDate?: string) {
    const brand = await authorise(subject, 'all');
    const date = asOf(rawDate) ?? new Date().toISOString().slice(0, 10);
    const [b] = await prisma.$queryRaw<Array<{ country: number | null }>>`SELECT country FROM oa_brands WHERE "OA_BRAND_ID" = ${brand}`;
    const india = Number(b?.country) === 216;
    const rows = await esrRows(brand, date, 'excel');
    const head = ['Employee ID', 'Employee Name', 'Department', 'Cost Center Code', 'Location Name', 'Designation', 'Employee DOJ', 'Gender',
      india ? 'PAN Number' : 'NI Number', 'Grade', 'Company Name', 'Office Address', 'Email', 'Skype', 'Contact Number', 'Association Type',
      'Confirmation Date', 'Last Appraisal Date', 'Appraisal Type', 'Resignation Date', 'Termination Date', 'Termination Reason',
      'Father/Husband Name', 'Residential Address', 'Qualification', 'Passport', 'DOB', 'Blood Group', 'Account No', 'Bank Name', 'IFSC Code',
      'Gross Salary', ...(india ? ['Aadhar Number', 'Cost Center', 'Carreer Streams', 'Designation/Role']
        : ['Tax Reference No', 'Marital Status', 'Cost Center', 'Carreer Streams', 'Designation/Role'])];
    const keys = ['EMP_NBR', 'EMP_FULL_NAME', 'DEPARTMENT', 'COST_CENTER', 'LOCATION_NAME', 'DESIGNATION', 'DATE_OF_JOINING', 'GENDER', 'EMP_PAN_NBR',
      'EMP_GRADE', 'COMPANY_NAME', 'OFFICE_ADDRESS', 'EMAIL_ADD', 'SKYPE_ID', 'FULL_PHONE_NBR', 'EMPLOYMENT_TYPE', 'CONFIRMATION_DATE',
      'LAST_APPRAISAL_DATE', 'APPRAISALTYPE', 'RESIGNATION_DATE', 'TERMINATION_DATE', 'TERMINATION', 'PARENT_NAME', 'RESIDENTIAL_ADDRESS',
      'EDUCATION_NAME', 'PASSPORT_NO', 'DOB', 'BLOOD_GRP', 'ACCOUNT_NO', 'BANK_NAME', 'IFSC_CODE', 'EMP_GROSS_SALARY',
      ...(india ? ['EMP_SIN_NBR', 'COST_CENTER_NM', 'CAREERSTREAM_NM', 'DESIGNATION'] : ['TAX_REF_NO', 'MARITAL_STATUS', 'COST_CENTER_NM', 'CAREERSTREAM_NM', 'DESIGNATION'])];
    const data = rows.map((r) => {
      // CI: CONCAT(EMP_MIDDLE_NM, ' ', EMPLST_NM) — empty when the middle name is missing.
      const parent = r.EMP_MIDDLE_NM && String(r.EMP_MIDDLE_NM).trim() ? `${r.EMP_MIDDLE_NM} ${r.EMPLST_NM ?? ''}`.trim() : null;
      return keys.map((k) => na(k === 'PARENT_NAME' ? parent : r[k]));
    });
    const ws = XLSX.utils.aoa_to_sheet([head, ...data]);
    ws['!cols'] = head.map((h) => ({ wch: Math.max(12, h.length + 2) }));
    // Account numbers, IFSC and the like stay text (CI setCellValueExplicit).
    for (let r = 1; r <= data.length; r++) for (let c = 0; c < head.length; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) { cell.t = 's'; cell.z = '@'; }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Worksheet');
    return { name: `ESR_${date.replace(/-/g, '')}.xlsx`, data: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer };
  },

  /** "Generate ESR PDF Report": the ESR fields as a landscape table (CI emp_mst/pdf). */
  async esrPdf(subject: RequestSubject, rawDate?: string) {
    const brand = await authorise(subject, 'all');
    const date = asOf(rawDate);
    const rows = await esrRows(brand, date, 'csv');
    const doc = new jsPDF({ unit: 'pt', format: 'a1', orientation: 'landscape' });
    doc.setFont('helvetica', 'bold').setFontSize(14);
    doc.text(`Employee Status Report${date ? ` as of ${date.split('-').reverse().join('-')}` : ''}`, 24, 30);
    autoTable(doc, {
      startY: 42,
      margin: { left: 24, right: 24 },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 6, cellPadding: 2, overflow: 'linebreak', lineColor: 180, lineWidth: 0.3 },
      headStyles: { fillColor: [251, 230, 221], textColor: [180, 68, 31], fontStyle: 'bold' },
      head: [PDF_COLUMNS.map(([h]) => h)],
      body: rows.map((r) => PDF_COLUMNS.map(([, k]) => na(r[k]))),
    });
    return { name: `ESR_${today()}.pdf`, data: Buffer.from(doc.output('arraybuffer')) };
  },

  /**
   * "Generate Appraisal Report" (CI getAllCurrentEMP): current employees with 3+ years of service whose last appraisal
   * is 12+ months old, with a 10 % increment worked out on the job's yearly gross. appraisalReport_YYYYMMDD.csv.
   */
  async appraisalCsv(subject: RequestSubject) {
    const brand = await authorise(subject, 'all');
    const rows = await prisma.$queryRawUnsafe<Array<{ name: string; last: string | null; gross: string | null }>>(
      `SELECT ${fullName('em')} AS name, to_char(j."LAST_APPRAISAL_DATE", 'YYYY-MM-DD') AS last, j."EMP_GROSS_SALARY"::text AS gross
       FROM emp_mst em
       LEFT JOIN LATERAL (SELECT * FROM job_mst x WHERE x."EMP_ID" = em."EMP_ID" AND x."IS_DELETED" = 0 ORDER BY x."JOB_ID" DESC LIMIT 1) j ON true
       WHERE em."IS_DELETED" = 0 AND em."OA_BRAND_ID" = $1::int
         AND em."EMP_STATUS_ID" = (SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = 'EMSC' ORDER BY im."MSTR_ID" LIMIT 1)
         AND j."DATE_OF_JOINING" <= (current_date - interval '3 years')
         AND (j."LAST_APPRAISAL_DATE" IS NULL OR j."LAST_APPRAISAL_DATE" <= (current_date - interval '12 months'))
       ORDER BY em."EMP_ID"`,
      brand,
    );
    // PHP echoes floats with 14 significant digits and no trailing zeros ("1000", "1100", "41666.666666667").
    const money = (n: number) => String(Number(n.toPrecision(14)));
    const monthsSince = (last: string | null) => {
      // CI month_gap: months from the last appraisal up to and including this month.
      if (!last) return '0';
      const [y, m, d] = last.split('-').map(Number);
      const end = new Date();
      const stop = new Date(end.getFullYear(), end.getMonth() + 1, end.getDate());
      let n = 0;
      while (new Date(y, m - 1 + n, d) < stop) n++;
      return String(n);
    };
    const header = ['Sr.No', 'Name Of Employees', 'Last Appraisal Date', 'Month Since Last Appraisal', 'Current Salary Montly', '10% Increment Monthly',
      'Actual Increment Monthly', 'Actual Increment Annually', 'Actual % Increment', 'New Salary Annually', 'New Salary Monthly', 'Increment Difference',
      'Rating 2021-22', 'Remark'];
    const lines = [header.map(fputcsvCell).join(',')];
    rows.forEach((r, i) => {
      const monthly = Number(r.gross ?? 0) / 12;
      const tenPct = monthly + (monthly * 10) / 100;
      const aim = (monthly * 10) / 100;
      lines.push([String(i + 1), r.name, r.last ?? '', monthsSince(r.last), money(monthly), money(tenPct), money(aim), money(aim * 12), '10%',
        money(tenPct * 12), money(tenPct), '10%', '', ''].map(fputcsvCell).join(','));
    });
    return { name: `appraisalReport_${today()}.csv`, data: Buffer.from(`${lines.join('\n')}\n`, 'utf8') };
  },

  /**
   * "Update Employees with current settings" (CI updateEmployee → updateEmployeeSetting): the selected employees' biometric
   * reference number = the digits of their employee code, with the brand's biometric prefix (settings SBDWOB / BSUBPN).
   */
  async updateSettings(subject: RequestSubject, body: unknown): Promise<{ count: number; skipped: number; message: string }> {
    if (subject.adminLevel === 0 || !(await menuPolicy(EMP_SCREENS.all.menu).check(subject, 'update'))) throw new ForbiddenError();
    const brand = subject.oaBrandId ?? null;
    if (!brand) throw new BusinessRuleError('Select a brand first.');
    const parsed = z.object({ ids: z.array(z.coerce.number().int().positive()).min(1).max(1000) }).safeParse(body ?? {});
    if (!parsed.success) throw new ValidationError('Please select at least one employee.', { ids: ['Please select at least one employee.'] });
    const ids = [...new Set(parsed.data.ids)];
    const [shared, prefix] = await Promise.all([settingService.getValue('SBDWOB', brand), settingService.getValue('BSUBPN', brand)]);
    const usePrefix = (shared ?? '').trim().toLowerCase() === 'yes' && Number(prefix) > 0;
    const rows = await prisma.$queryRaw<Array<{ id: number; code: string | null }>>`
      SELECT "EMP_ID" AS id, "EMP_NBR" AS code FROM emp_mst WHERE "EMP_ID" = ANY(${ids}::int[]) AND "IS_DELETED" = 0 AND "OA_BRAND_ID" = ${brand}`;
    let count = 0;
    let skipped = 0;
    await prisma.$transaction(async (tx) => {
      for (const r of rows) {
        // CI: preg_replace('/([a-zA-Z]+)(\d+)/', '$2', EMP_NBR) — the code's letters dropped before each run of digits.
        const digits = String(r.code ?? '').replace(/([a-zA-Z]+)(\d+)/g, '$2');
        const ref = /^\d+$/.test(digits) ? `${usePrefix ? String(Number(prefix)) : ''}${digits}` : null;
        if (!ref || ref.length > 9) { skipped++; continue; }
        await tx.$executeRaw`UPDATE emp_mst SET "REF_EMP_NBR" = ${Number(ref)}, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now() WHERE "EMP_ID" = ${Number(r.id)}`;
        count++;
      }
    });
    skipped += ids.length - rows.length;
    return { count, skipped, message: 'Employees Updated!!' };
  },
};

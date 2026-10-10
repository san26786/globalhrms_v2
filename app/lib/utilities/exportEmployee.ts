import { prisma } from '@/lib/prisma';
import { masterNames } from '@/lib/masters/masterService';
import { toCsv, type CsvValue } from './csv';

/**
 * Export Employee — port of CI utilities/export_employee::export().
 *
 * CI selected from emp_manager_new_vw JOIN job_mst_vw (views that were not migrated to PostgreSQL);
 * the same columns are rebuilt here from the base tables:
 *   emp_mst (names, DOB, ids, manager), job_mst (current job: status, type, department, designation,
 *   grade, holiday group, cost centre, dates, gross salary; emp_mst values as fallback),
 *   independent_mst (master names), oa_brands (branch code), oa_contact_emails → contact_emails →
 *   email_address_mst (e-mail), oa_contact_phones (phone).
 *
 * Column order/headers are CI's exactly (export_employee.php:85-133), including the columns CI always
 * left empty. "Without data" returns the header row only (CI WHERE 1 = 2).
 *
 * Differences from CI: "With data" is limited to the caller's active brand (CI's elseif compared
 * 'withoutData' twice, so it exported every brand of every organisation); deleted employees are
 * excluded; an employee with several job rows appears once (latest job) instead of once per job row.
 * Aadhar / PAN are exported as in CI — the route only allows administrators.
 */

export const EMPLOYEE_EXPORT_HEADERS = [
  'Employee Code',
  'First Name',
  'Middle Name',
  'Last Name',
  'Full Name',
  'Initials',
  'Is Manager',
  'Manager',
  'DOB',
  'Gender',
  'Marital Status',
  'Caste',
  'Blood Group',
  'E Mail Id 1',
  'E Mail Id 2',
  'Phone Number1',
  'Phone Number2',
  'Aadhar Number',
  'Pan Number',
  'Branch Code',
  'Employee Status',
  'Employement Type',
  'Class',
  'Department',
  'Designation',
  'Cost Center',
  'Holiday Group',
  'Grade',
  'Date of Joining',
  'Confirmation Date',
  'Basic Salary',
  'AGP/D.P.',
  'D.A.',
  'H.R.A.',
  'CLA',
  'T.A.',
  'S.A.',
  'Gross Salary',
  'PF Deduction',
  'Professional Tax',
  'Advance',
  'Loan',
  'Tax Deducted at Source (TDS)',
  'Gross Deduction',
  'Net Payment',
] as const;

const EMPTY_PAYROLL_COLUMNS = 7; // Basic Salary … S.A.
const EMPTY_DEDUCTION_COLUMNS = 7; // PF Deduction … Net Payment

function toIntId(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

function fullName(...parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

export async function buildEmployeeCsv(oaBrandId: number, withData: boolean): Promise<string> {
  if (!withData) return toCsv([...EMPLOYEE_EXPORT_HEADERS], []);

  const employees = await prisma.emp_mst.findMany({
    where: { OA_BRAND_ID: oaBrandId, IS_DELETED: 0 },
    select: {
      EMP_ID: true,
      EMP_NBR: true,
      EMP_NAME: true,
      EMP_MIDDLE_NM: true,
      EMPLST_NM: true,
      IS_MANAGER: true,
      MANAGER_ID: true,
      DOB: true,
      GENDER_ID: true,
      MARITAL_STATUS_ID: true,
      CAST_ID: true,
      BLOOD_GRP: true,
      OA_CNTCT_EML_ID: true,
      OA_CNTCT_PHONE_ID: true,
      EMP_SSN_NBR: true,
      EMP_PAN_NBR: true,
      EMP_STATUS_ID: true,
      EMP_TYPE_ID: true,
      DEPARTMENT: true,
      COST_CENTER: true,
      EMP_GRADE_ID: true,
      DATE_OF_JOINING: true,
      GROSS_SALARY: true,
    },
    orderBy: [{ EMP_NBR: 'asc' }, { EMP_ID: 'asc' }],
  });
  if (!employees.length) return toCsv([...EMPLOYEE_EXPORT_HEADERS], []);

  const empIds = employees.map((e) => e.EMP_ID);
  const jobs = await prisma.job_mst.findMany({
    where: { EMP_ID: { in: empIds }, IS_DELETED: 0 },
    select: {
      EMP_ID: true,
      EMP_STATUS_ID: true,
      EMP_TYPE_ID: true,
      DEPARTMENT_ID: true,
      DESIGNATION_ID: true,
      EMP_GRADE_ID: true,
      HOLIDAY_GRP_ID: true,
      COST_CENTER: true,
      IS_MANAGER: true,
      MANAGER_ID: true,
      DATE_OF_JOINING: true,
      CONFIRMATION_DATE: true,
      EMP_GROSS_SALARY: true,
    },
    orderBy: { JOB_ID: 'desc' },
  });
  const jobByEmp = new Map<number, (typeof jobs)[number]>();
  for (const j of jobs) if (!jobByEmp.has(j.EMP_ID)) jobByEmp.set(j.EMP_ID, j);

  // CI JOIN job_mst_vw: only employees that have a job record.
  const rows = employees.filter((e) => jobByEmp.has(e.EMP_ID));

  const managerIds = rows.map((e) => toIntId(jobByEmp.get(e.EMP_ID)?.MANAGER_ID) ?? toIntId(e.MANAGER_ID));
  const emailLinkIds = rows.map((e) => toIntId(e.OA_CNTCT_EML_ID)).filter((v): v is number => v !== null);
  const phoneLinkIds = rows.map((e) => toIntId(e.OA_CNTCT_PHONE_ID)).filter((v): v is number => v !== null);

  const [brand, managers, emails, phones] = await Promise.all([
    prisma.oa_brands.findFirst({ where: { OA_BRAND_ID: oaBrandId }, select: { OA_BRAND_CD: true } }),
    prisma.emp_mst.findMany({
      where: { EMP_ID: { in: managerIds.filter((v): v is number => v !== null) } },
      select: { EMP_ID: true, EMP_NAME: true, EMP_MIDDLE_NM: true, EMPLST_NM: true },
    }),
    emailLinkIds.length ? loadEmails(emailLinkIds) : Promise.resolve(new Map<number, string>()),
    phoneLinkIds.length
      ? prisma.oa_contact_phones.findMany({
          where: { OA_CNTCT_PHONE_ID: { in: phoneLinkIds } },
          select: { OA_CNTCT_PHONE_ID: true, EMP_PHONE: true },
        })
      : Promise.resolve([]),
  ]);
  const managerName = new Map(managers.map((m) => [m.EMP_ID, fullName(m.EMP_NAME, m.EMP_MIDDLE_NM, m.EMPLST_NM)]));
  const phoneById = new Map(phones.map((p) => [p.OA_CNTCT_PHONE_ID, p.EMP_PHONE]));

  const masterIds: Array<number | null> = [];
  for (const e of rows) {
    const j = jobByEmp.get(e.EMP_ID);
    masterIds.push(
      e.GENDER_ID,
      e.MARITAL_STATUS_ID,
      e.CAST_ID,
      toIntId(e.BLOOD_GRP),
      j?.EMP_STATUS_ID ?? e.EMP_STATUS_ID,
      j?.EMP_TYPE_ID ?? e.EMP_TYPE_ID,
      j?.DEPARTMENT_ID ?? e.DEPARTMENT,
      j?.DESIGNATION_ID ?? null,
      j?.HOLIDAY_GRP_ID ?? null,
      j?.EMP_GRADE_ID ?? e.EMP_GRADE_ID,
    );
  }
  const names = await masterNames(masterIds);
  const master = (id: number | null | undefined) => (id ? names.get(id)?.name ?? '' : '');

  const data: CsvValue[][] = rows.map((e, i) => {
    const j = jobByEmp.get(e.EMP_ID);
    const managerId = managerIds[i];
    const bloodId = toIntId(e.BLOOD_GRP);
    const emailId = toIntId(e.OA_CNTCT_EML_ID);
    const phoneId = toIntId(e.OA_CNTCT_PHONE_ID);
    return [
      e.EMP_NBR,
      e.EMP_NAME,
      e.EMP_MIDDLE_NM,
      e.EMPLST_NM,
      fullName(e.EMP_NAME, e.EMP_MIDDLE_NM, e.EMPLST_NM),
      '',
      j?.IS_MANAGER ?? e.IS_MANAGER,
      managerId ? managerName.get(managerId) ?? '' : '',
      e.DOB,
      master(e.GENDER_ID),
      master(e.MARITAL_STATUS_ID),
      master(e.CAST_ID),
      bloodId ? master(bloodId) : e.BLOOD_GRP,
      emailId ? emails.get(emailId) ?? '' : '',
      '',
      phoneId ? phoneById.get(phoneId) ?? '' : '',
      '',
      e.EMP_SSN_NBR,
      e.EMP_PAN_NBR,
      brand?.OA_BRAND_CD ?? '',
      master(j?.EMP_STATUS_ID ?? e.EMP_STATUS_ID),
      master(j?.EMP_TYPE_ID ?? e.EMP_TYPE_ID),
      '',
      master(j?.DEPARTMENT_ID ?? e.DEPARTMENT),
      master(j?.DESIGNATION_ID),
      j?.COST_CENTER ?? e.COST_CENTER,
      master(j?.HOLIDAY_GRP_ID),
      master(j?.EMP_GRADE_ID ?? e.EMP_GRADE_ID),
      j?.DATE_OF_JOINING ?? e.DATE_OF_JOINING,
      j?.CONFIRMATION_DATE,
      ...Array<string>(EMPTY_PAYROLL_COLUMNS).fill(''),
      j?.EMP_GROSS_SALARY ?? e.GROSS_SALARY,
      ...Array<string>(EMPTY_DEDUCTION_COLUMNS).fill(''),
    ];
  });

  return toCsv([...EMPLOYEE_EXPORT_HEADERS], data);
}

/** oa_contact_emails.OA_CNTCT_EML_ID → e-mail address (oa_contact_emails.CNTCT_EML_ID → contact_emails → email_address_mst). */
async function loadEmails(linkIds: number[]): Promise<Map<number, string>> {
  const links = await prisma.oa_contact_emails.findMany({
    where: { OA_CNTCT_EML_ID: { in: linkIds } },
    select: { OA_CNTCT_EML_ID: true, CNTCT_EML_ID: true },
  });
  const contactIds = [...new Set(links.map((l) => toIntId(l.CNTCT_EML_ID)).filter((v): v is number => v !== null))];
  if (!contactIds.length) return new Map();
  const contacts = await prisma.contact_emails.findMany({
    where: { CNTCT_EML_ID: { in: contactIds } },
    select: { CNTCT_EML_ID: true, EMAIL_ADD_ID: true },
  });
  const addresses = await prisma.email_address_mst.findMany({
    where: { EMAIL_ADD_ID: { in: [...new Set(contacts.map((c) => c.EMAIL_ADD_ID))] } },
    select: { EMAIL_ADD_ID: true, EMAIL_ADD: true },
  });
  const addressById = new Map(addresses.map((a) => [a.EMAIL_ADD_ID, a.EMAIL_ADD]));
  const addressByContact = new Map(contacts.map((c) => [c.CNTCT_EML_ID, addressById.get(c.EMAIL_ADD_ID) ?? '']));
  const result = new Map<number, string>();
  for (const l of links) {
    const contactId = toIntId(l.CNTCT_EML_ID);
    if (contactId) result.set(l.OA_CNTCT_EML_ID, addressByContact.get(contactId) ?? '');
  }
  return result;
}

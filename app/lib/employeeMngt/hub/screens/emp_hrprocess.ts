import { EMAIL_EXPR, PHONE_EXPR } from '../../empList';
import { empHrprocessDefs } from '../defs/emp_hrprocess';
import { masterName, type HubConfig } from '../hubEngine';
import { LATEST_ALIVE } from './job_mst';

/**
 * CI employeeMngt/emp_hrprocess ("Employee Details", Payroll): the employees' identity and current job — the
 * master data annexure generation and payslips read (gross salary, currency, department, designation, joining
 * date, code, name, e-mail). One row per employee with a live job: the current job (highest live JOB_ID).
 *
 * Behaviour changes: a worklist, not a form — Edit opens Job Detail (and comes back), the row menu opens Personal
 * Details, Bank Accounts and Investment Details, each with its own rules. CI's form saved a cut-down copy of
 * those screens without their rules (it zeroed the employee's contact link on every save, a failed validation
 * made the next save change another employee's job, a link could wipe an employee's record, any employee of any
 * brand could be opened by id, and nine of its fields were never saved). New: the "Missing for Payroll" column
 * (CI's annexure run stops at the first employee without a gross salary), and current employees are listed unless
 * another status is chosen (CI listed everyone, including employees whose form then failed for want of a job).
 */
const live = (alias: string) => `btrim(COALESCE(${alias}."IS_DELETED", '0'), '''') = '0'`; // bank_dtl.IS_DELETED is text
const INDIA = `(SELECT b."country" FROM oa_brands b WHERE b."OA_BRAND_ID" = em."OA_BRAND_ID" LIMIT 1)
  = (SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = 'IN' ORDER BY im."MSTR_ID" LIMIT 1)`;
const CURRENCY = `(SELECT c."CURR_NAME" FROM currency_mst c WHERE c."CURR_ID" = t."CURRENCY_ID" LIMIT 1)`;
const DEPARTMENT = masterName('t."DEPARTMENT_ID"');
const DESIGNATION = masterName('t."DESIGNATION_ID"');

const LIST_COLUMNS = `em."EMP_INITIALS", to_char(em."DOB", 'YYYY-MM-DD') AS "DOB", ${masterName('em."GENDER_ID"')} AS "GENDER",
  ${EMAIL_EXPR} AS "EMAIL_ADD",
  NULLIF(btrim(COALESCE(${masterName('em."COUNTRY_CODE"')}, '') || ' ' || COALESCE(${PHONE_EXPR}, '')), '') AS "FULL_PHONE_NBR",
  (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = em."EMP_STATUS_ID" LIMIT 1) AS "EMP_STATUS_CD",
  ${masterName('em."EMP_STATUS_ID"')} AS "EMP_STATUS",
  t."EMP_GROSS_SALARY", ${CURRENCY} AS "CURRENCY_NM", ${masterName('t."EMP_STATUS_ID"')} AS "JOB_STATUS",
  ${DEPARTMENT} AS "DEPARTMENT_NAME", ${DESIGNATION} AS "DESIGNATION_NAME", to_char(t."DATE_OF_JOINING", 'YYYY-MM-DD') AS "DATE_OF_JOINING",
  NULLIF(concat_ws(', ',
    CASE WHEN COALESCE(t."EMP_GROSS_SALARY", 0) <= 0 THEN 'Gross Salary' END,
    CASE WHEN ${CURRENCY} IS NULL THEN 'Currency' END,
    CASE WHEN ${DEPARTMENT} IS NULL THEN 'Department' END,
    CASE WHEN ${DESIGNATION} IS NULL THEN 'Designation' END,
    CASE WHEN t."DATE_OF_JOINING" IS NULL THEN 'Date of Joining' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM bank_dtl b WHERE b."EMP_ID" = em."EMP_ID" AND b."IS_PRIMARY" = 1 AND ${live('b')}) THEN 'Bank Account' END,
    CASE WHEN COALESCE(btrim(em."EMP_PAN_NBR"), '') = '' AND ${INDIA} THEN 'PAN' END
  ), '') AS "MISSING"`;

export const empHrprocessConfig: HubConfig = {
  key: 'emp_hrprocess',
  defs: empHrprocessDefs,
  table: 'job_mst',
  pk: 'JOB_ID',
  empColumn: 'EMP_ID',
  alive: `t."IS_DELETED" = 0 AND ${LATEST_ALIVE}`,
  listColumns: LIST_COLUMNS,
  search: ['EMAIL_ADD', 'FULL_PHONE_NBR', 'GENDER', 'JOB_STATUS', 'DEPARTMENT_NAME', 'DESIGNATION_NAME', 'CURRENCY_NM', 'MISSING'],
  sorts: ['DOB', 'GENDER', 'EMAIL_ADD', 'EMP_STATUS', 'EMP_GROSS_SALARY', 'CURRENCY_NM', 'JOB_STATUS', 'DEPARTMENT_NAME', 'DESIGNATION_NAME', 'DATE_OF_JOINING'],
  defaultSort: 'v."EMPLOYEE_ID" DESC', // CI: ORDER BY EMP_ID DESC
  bind: {},
  deleteMode: 'soft',
  noCreate: true,
  worklistOf: { menu: 'job/job_mst', adminOnlyWrites: true },
  messages: { created: '', updated: '', deleted: '' },

  // Employee status: current unless chosen ("all" = every status); `missing=1`: only employees with gaps.
  listFilter(q, sql) {
    const conditions: string[] = [];
    const status = (q.status ?? '').trim();
    if (status !== 'all') conditions.push(`v."EMP_STATUS_CD" = ${sql.p(status === 'EMSF' ? 'EMSF' : 'EMSC')}`);
    if (q.missing === '1') conditions.push('v."MISSING" IS NOT NULL');
    return conditions.length ? conditions.join(' AND ') : null;
  },
};

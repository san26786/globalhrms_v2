import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { settingService, toNumber } from '@/lib/settings/settingService';
import { HOURLY_BASIS, PART_TIME_TYPE, jobMstDefs, jobProbationDefs } from '../defs/job_mst';
import { insertRow, isDate, masterName, updateRow, type DbValue, type HubConfig, type HubOptionList } from '../hubEngine';
import { brandMasters, brandOnlyMasters, currencyLabel, currencyOptions, keepCurrent, masterLabel, mastersByCode } from '../hubOptions';

/**
 * CI job/job_mst ("Job Detail"): an employee's job — type and status, salary, department, location,
 * designation… (table job_mst). An employee may have several rows (a rejoin, a change of type); the
 * current job is the highest live JOB_ID, which Employee Manager and payroll read.
 *
 * As CI: only admins add, edit or delete (normal users see the list); the employee status options are
 * those of the chosen employee type; a new job starts as Full Time / Probation; saving the current job
 * keeps the employee's primary work location (emp_reporting_locations) in step.
 *
 * Behaviour changes: hourly / daily / monthly pay are worked out on the server from the gross salary
 * (part-time: from the hourly rate) with the brand's working hours and days (CI took them from the
 * browser, which could rewrite the gross with a rounded figure); the gross salary is a whole number
 * (an integer column); an empty confirmation date is filled from the joining date and the brand's
 * probation period at save time (CI's form did it on load); the status must belong to the type; the
 * primary work location stays primary (CI's update demoted it on every save); options are the
 * employee's brand's; the payslip password is not listed. Not migrated: the rejoin flow, the Mediclaim
 * deduction on the salary annexure and the New Regime checkbox (CI showed it but never saved it).
 */
/** t is the employee's current job: no later live job row. */
export const LATEST_ALIVE = `NOT EXISTS (SELECT 1 FROM job_mst j2 WHERE j2."EMP_ID" = t."EMP_ID" AND j2."IS_DELETED" = 0 AND j2."JOB_ID" > t."JOB_ID")`;
const JOB_TITLE = 158;

const LIST_COLUMNS = `t."EMP_GROSS_SALARY",
  (SELECT c."CURR_NAME" FROM currency_mst c WHERE c."CURR_ID" = t."CURRENCY_ID" LIMIT 1) AS "CURRENCY_NM",
  ${masterName('t."EMP_STATUS_ID"')} AS "STATUS_NAME", ${masterName('t."EMP_TYPE_ID"')} AS "TYPE_NAME",
  ${masterName('t."DEPARTMENT_ID"')} AS "DEPARTMENT_NAME", ${masterName('t."DESIGNATION_ID"')} AS "DESIGNATION_NAME",
  ${masterName('t."HOLIDAY_GRP_ID"')} AS "HOLIDAY_GRP", ${masterName('t."JOB_TITLE_ID"')} AS "JOB_TITLE",
  ${masterName('t."JOB_CAT_ID"')} AS "JOB_CATEGORY", t."WORK_STATION", ${masterName('t."EMP_BAND_ID"')} AS "EMP_BAND",
  to_char(t."DATE_OF_JOINING", 'YYYY-MM-DD') AS "DATE_OF_JOINING", CASE WHEN t."IS_REJOIN" = 1 THEN 'Yes' ELSE 'No' END AS "IS_REJOIN",
  ${masterName('t."COST_CENTER"')} AS "COST_CENTER_NAME",
  to_char(t."CONFIRMATION_DATE", 'YYYY-MM-DD') AS "CONFIRMATION_DATE", to_char(t."LAST_APPRAISAL_DATE", 'YYYY-MM-DD') AS "LAST_APPRAISAL_DATE",
  ${masterName('t."WORK_LOCATION"')} AS "WORK_LOCATION", ${masterName('t."POSITION_ID"')} AS "POSTION_NM",
  ${masterName('t."PAYMENT_METHOD"')} AS "PAYMENT_METHOD_NM",
  t."BASIC_HOURLY"::text AS "BASIC_HOURLY", t."BASIC_DAILY"::text AS "BASIC_DAILY", t."MAX_HOURS_AGREED"::text AS "MAX_HOURS_AGREED",
  t."BASIC_MONTHLY"::text AS "BASIC_MONTHLY", to_char(t."PAYROLL_START_DATE", 'YYYY-MM-DD') AS "PAYROLL_START_DATE",
  t."AUTO_PAY_NUMBER", NULLIF(t."COMMITED_HOURS", 0) AS "COMMITED_HOURS", t."MEDICLAIM"::text AS "MEDICLAIM",
  ${masterName('t."SALARY_CALC_BASIS"')} AS "SALARY_CALC_BASIS_NM", CASE WHEN t."NEW_REGIME" THEN 'Yes' ELSE 'No' END AS "NEW_REGIME"`;

/** CI getEmploymentStatus(type): every job status, tagged with the employee type it belongs to. */
async function statusOptions(): Promise<HubOptionList> {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string; parent: number | null }>>`
    SELECT im."MSTR_ID" AS value, im."MSTR_NM" AS label, im."PARENT_MSTR_ID" AS parent
    FROM independent_mst im JOIN common_type ct ON ct."TYP_ID" = im."TYP_ID"
    WHERE ct."TYP_CD" = 'ES' AND COALESCE(im."IS_DELETED", false) = false
    ORDER BY im."SEQUENCE" NULLS LAST, im."MSTR_NM"`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label, ...(r.parent ? { parent: Number(r.parent) } : {}) }));
}

/** CI salary calculation bases: the values of setting SSASCLBSS (Daily / Hourly). */
async function salaryBasisOptions(): Promise<HubOptionList> {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string }>>`
    SELECT DISTINCT v."SYSTEM_SETTING_ATTRIBUTE_VALUE_ID" AS value, im."MSTR_NM" AS label
    FROM "setting_group_attribute_Value_mst" v JOIN independent_mst im ON im."MSTR_ID" = v."SYSTEM_SETTING_ATTRIBUTE_VALUE_ID"
    WHERE v."SETTING_ATTRIBUTE_CD" = 'SSASCLBSS' AND v."IS_DELETED" = 0
    ORDER BY label`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label }));
}

const round2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** CI getSalaryRates / getSalaryRatesByHourlyIncome, with the brand's working hours a day and days a week. */
async function salaryFigures(v: Record<string, string | boolean>, brand: number): Promise<Record<string, DbValue>> {
  const [hours, days] = await Promise.all([
    settingService.getValueOrDefault('SSAFTEH', brand),
    settingService.getValueOrDefault('SSAWDPW', brand),
  ]);
  const hoursPerDay = toNumber(hours);
  const annualHours = toNumber(days) * hoursPerDay * 52;
  if (String(v.EMP_TYPE_ID) === PART_TIME_TYPE) {
    const hourly = Number(v.EMP_basic_hourly) || 0;
    const annual = Math.round(hourly * annualHours);
    return { EMP_GROSS_SALARY: annual, BASIC_HOURLY: round2(hourly), BASIC_DAILY: round2(hourly * hoursPerDay), BASIC_MONTHLY: round2(annual / 12) };
  }
  const gross = Number(v.EMP_grossy_salary) || 0;
  const hourly = annualHours ? gross / annualHours : 0;
  return { BASIC_HOURLY: round2(hourly), BASIC_DAILY: round2(hourly * hoursPerDay), BASIC_MONTHLY: round2(gross / 12) };
}

/** CI completeProPeriod(): the joining date plus the brand's probation tenure (end of month when it overflows). */
async function confirmationDate(joining: string, brand: number): Promise<string | null> {
  const [tenure, frequency] = await Promise.all([
    settingService.getValueOrDefault('SSAECT', brand),
    settingService.getValueOrDefault('SSAECF', brand),
  ]);
  const count = toNumber(tenure);
  if (!count || !isDate(joining)) return null;
  const date = new Date(`${joining}T00:00:00Z`);
  const unit = (frequency ?? '').trim().toLowerCase();
  if (unit.startsWith('week')) date.setUTCDate(date.getUTCDate() + 7 * count);
  else if (unit.startsWith('day') || unit.startsWith('daily')) date.setUTCDate(date.getUTCDate() + count);
  else if (unit.startsWith('month')) {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + count);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, last));
  } else return null;
  return date.toISOString().slice(0, 10);
}

const number = (value: string | boolean) => String(value).trim();

export const jobMstConfig: HubConfig = {
  key: 'job_mst',
  defs: jobMstDefs,
  table: 'job_mst',
  pk: 'JOB_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: LIST_COLUMNS,
  search: ['STATUS_NAME', 'TYPE_NAME', 'DEPARTMENT_NAME', 'DESIGNATION_NAME', 'JOB_TITLE', 'WORK_LOCATION', 'COST_CENTER_NAME'],
  sorts: ['EMP_GROSS_SALARY', 'STATUS_NAME', 'TYPE_NAME', 'DEPARTMENT_NAME', 'DESIGNATION_NAME', 'JOB_TITLE', 'DATE_OF_JOINING',
    'COST_CENTER_NAME', 'CONFIRMATION_DATE', 'LAST_APPRAISAL_DATE', 'WORK_LOCATION', 'PAYROLL_START_DATE'],
  bind: {
    DATE_OF_JOINING: 'DATE_OF_JOINING', PAYROLL_START_DATE: 'PAYROLL_START_DATE', EMP_TYPE_ID: 'EMP_TYPE_ID', EMP_STATUS_ID: 'EMP_STATUS_ID',
    EMP_auto_pay_no: 'AUTO_PAY_NUMBER', EMP_payslip_pdf_password: 'PAYSLIP_PDF_PASSWORD', max_hrs_agreed: 'MAX_HOURS_AGREED',
    EMP_grossy_salary: 'EMP_GROSS_SALARY', EMP_basic_hourly: 'BASIC_HOURLY', EMP_basic_daily: 'BASIC_DAILY', EMP_basic_monthly: 'BASIC_MONTHLY',
    CURRENCY_ID: 'CURRENCY_ID', payment_method: 'PAYMENT_METHOD', salaryCalcBasis: 'SALARY_CALC_BASIS', Emp_commited_hours: 'COMMITED_HOURS',
    Emp_mediclaim: 'MEDICLAIM', department: 'DEPARTMENT_ID', WORK_LOCATION: 'WORK_LOCATION', DESIGNATION: 'DESIGNATION_ID',
    JOB_CAT_ID: 'JOB_CAT_ID', JOB_TITLE_ID: 'JOB_TITLE_ID', POSITION_ID: 'POSITION_ID', EMP_BAND_ID: 'EMP_BAND_ID', EMP_GRADE_ID: 'EMP_GRADE_ID',
    CONFIRMATION_DATE: 'CONFIRMATION_DATE', LAST_APPRAISAL_DATE: 'LAST_APPRAISAL_DATE', APPRAISAL_TYPE: 'APPRAISAL_TYPE',
    HOLIDAY_GRP_ID: 'HOLIDAY_GRP_ID', WORK_STATION: 'WORK_STATION', ACHIEVEMENT_INFO: 'ACHIEVEMENT_INFO', costCenter: 'COST_CENTER',
  },
  deleteMode: 'soft',
  adminOnlyWrites: true,
  messages: {
    created: 'Successfully Added Job Details. Please Generate New Annexure',
    updated: 'Successfully Updated Job Details. Please Generate New Annexure If Salary is updated',
    deleted: 'Successfully Deleted Job Details',
  },

  async defaults() {
    const [type, status] = await Promise.all([getMasterId('ESFTE'), getMasterId('PROB')]);
    return { EMP_TYPE_ID: type ? String(type) : '', EMP_STATUS_ID: status ? String(status) : '' };
  },

  options: async (_subject, brand, row) => {
    const [types, statuses, currencies, payment, bases, departments, locations, designations, categories, titles, positions, bands, grades,
      appraisals, holidays, costCenters] = await Promise.all([
      mastersByCode('EMS'), statusOptions(), currencyOptions(brand), mastersByCode('TPM'), salaryBasisOptions(),
      brandMasters({ code: 'HTCPP' }, brand), brandOnlyMasters({ code: 'HTCHL' }, brand), brandMasters({ code: 'DES' }, brand),
      mastersByCode('JC'), brandMasters({ id: JOB_TITLE }, brand), mastersByCode('PL'), mastersByCode('EMBAND'), mastersByCode('EG'),
      mastersByCode('SEAT'), brandMasters({ code: 'HGRP' }, brand), mastersByCode('ECSTC'),
    ]);
    const keep = (list: HubOptionList, column: string) => keepCurrent(list, row?.[column], masterLabel);
    return {
      empTypes: await keep(types, 'EMP_TYPE_ID'),
      statuses: await keep(statuses, 'EMP_STATUS_ID'),
      currencies: await keepCurrent(currencies, row?.CURRENCY_ID, currencyLabel),
      paymentMethods: await keep(payment, 'PAYMENT_METHOD'),
      salaryBases: await keep(bases, 'SALARY_CALC_BASIS'),
      departments: await keep(departments, 'DEPARTMENT_ID'),
      workLocations: await keep(locations, 'WORK_LOCATION'),
      designations: await keep(designations, 'DESIGNATION_ID'),
      jobCategories: await keep(categories, 'JOB_CAT_ID'),
      jobTitles: await keep(titles, 'JOB_TITLE_ID'),
      positions: await keep(positions, 'POSITION_ID'),
      bands: await keep(bands, 'EMP_BAND_ID'),
      grades: await keep(grades, 'EMP_GRADE_ID'),
      appraisalTypes: await keep(appraisals, 'APPRAISAL_TYPE'),
      holidayGroups: await keep(holidays, 'HOLIDAY_GRP_ID'),
      costCenters: await keep(costCenters, 'COST_CENTER'),
    };
  },

  read(_row, values) {
    // CI stored 0 for "none" in these; blank on the form.
    for (const key of ['Emp_commited_hours', 'Emp_mediclaim', 'max_hrs_agreed']) {
      if (Number(values[key]) === 0) values[key] = '';
    }
  },

  validate(v, check, ctx) {
    const changed = (name: string) => v[name] !== ctx.existing?.[name];
    const partTime = String(v.EMP_TYPE_ID) === PART_TIME_TYPE;
    const gross = number(v.EMP_grossy_salary);
    if (!partTime && gross && changed('EMP_grossy_salary') && !check.has('EMP_grossy_salary') && (!/^\d{1,9}$/.test(gross) || Number(gross) <= 0)) {
      check.fail('EMP_grossy_salary', 'The Gross Salary field must be a whole number greater than zero.');
    }
    const hourly = number(v.EMP_basic_hourly);
    if (partTime && hourly && !check.has('EMP_basic_hourly') && (!/^\d{1,8}(\.\d{1,2})?$/.test(hourly) || Number(hourly) <= 0)) {
      check.fail('EMP_basic_hourly', 'The Basic Hourly field must be a number greater than zero.');
    }
    const numeric: Array<[string, string, RegExp]> = [
      ['max_hrs_agreed', 'Max Hours Agreed', /^\d{1,7}(\.\d{1,2})?$/],
      ['Emp_commited_hours', 'Committed Hours', /^\d{1,9}$/],
      ['Emp_mediclaim', 'MEDICLAIM', /^\d{1,8}(\.\d{1,2})?$/],
    ];
    for (const [name, label, pattern] of numeric) {
      const value = number(v[name]);
      if (value && changed(name) && !check.has(name) && !pattern.test(value)) check.fail(name, `The ${label} field must contain a positive number.`);
    }
    const joining = String(v.DATE_OF_JOINING);
    const confirmation = String(v.CONFIRMATION_DATE);
    if (joining && confirmation && (changed('DATE_OF_JOINING') || changed('CONFIRMATION_DATE'))
      && !check.has('DATE_OF_JOINING') && !check.has('CONFIRMATION_DATE') && confirmation < joining) {
      check.fail('CONFIRMATION_DATE', 'The Confirmation Date cannot be before the Date of Joining.');
    }
  },

  async extraColumns(v, ctx) {
    const extra: Record<string, DbValue> = { EMP_NBR: ctx.employee.code, ...(await salaryFigures(v, ctx.employee.brand)) };
    if (!v.CONFIRMATION_DATE && v.DATE_OF_JOINING) extra.CONFIRMATION_DATE = await confirmationDate(String(v.DATE_OF_JOINING), ctx.employee.brand);
    if (String(v.salaryCalcBasis) !== HOURLY_BASIS) extra.COMMITED_HOURS = 0;
    if (!ctx.id) extra.IS_REJOIN = 0;
    return extra;
  },

  /** The employee's current job sets their primary work location (CI job_mst setFormControls). */
  async afterWrite(tx, id, v, ctx) {
    const location = Number(v.WORK_LOCATION);
    if (!location) return;
    const [later] = await tx.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM job_mst WHERE "EMP_ID" = ${ctx.employee.id} AND "IS_DELETED" = 0 AND "JOB_ID" > ${id}`;
    if (later.n) return;
    const { employee, subject } = ctx;
    // The primary row moves to the location; else the row already there becomes primary; else one is added.
    const [target] = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT "EMP_REPORTING_LOCATIONS_ID" AS id FROM emp_reporting_locations
      WHERE "EMP_ID" = ${employee.id} AND "IS_DELETED" = 0 AND ("IS_PRIMARY" = 1 OR "LOCATION_ID" = ${location})
      ORDER BY "IS_PRIMARY" DESC, ("LOCATION_ID" = ${location}) DESC, "EMP_REPORTING_LOCATIONS_ID" DESC LIMIT 1`;
    const data = { LOCATION_ID: location, IS_PRIMARY: 1, OA_ID: employee.oaId, OA_BRAND_ID: employee.brand, USER_ID: employee.userId };
    const primaryId = target
      ? (await updateRow(tx, 'emp_reporting_locations', 'EMP_REPORTING_LOCATIONS_ID', Number(target.id), data, subject.userId), Number(target.id))
      : await insertRow(tx, 'emp_reporting_locations', 'EMP_REPORTING_LOCATIONS_ID', { ...data, EMP_ID: employee.id, EMP_NBR: employee.code }, subject.userId);
    await tx.$executeRaw`
      UPDATE emp_reporting_locations SET "IS_PRIMARY" = 0, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
      WHERE "EMP_ID" = ${employee.id} AND "IS_DELETED" = 0 AND "IS_PRIMARY" = 1 AND "EMP_REPORTING_LOCATIONS_ID" <> ${primaryId}`;
  },
};

/**
 * CI job/job_mst/probation ("Confirmation Pending"): the employees whose current job is still on
 * probation; Edit opens the Job Detail form (set the status to Confirmed there) and comes back here.
 *
 * Behaviour changes: only each employee's current job of a live employee (CI also listed older rows and
 * rows of deleted employees); part-time probation is included; sorted by confirmation date, oldest first.
 */
export const jobProbationConfig: HubConfig = {
  ...jobMstConfig,
  key: 'job_probation',
  defs: jobProbationDefs,
  alive: `t."IS_DELETED" = 0 AND ${LATEST_ALIVE}
    AND t."EMP_STATUS_ID" IN (SELECT "MSTR_ID" FROM independent_mst WHERE "MSTR_CD" IN ('PROB', 'PROBPT'))`,
  defaultSort: 'v."CONFIRMATION_DATE" ASC NULLS FIRST, v.id DESC',
  noCreate: true,
  // Edits happen on Job Detail (its grant); the worklist itself never writes (an empty PUT here zeroed the hourly / daily / monthly pay).
  worklistOf: { menu: 'job/job_mst', adminOnlyWrites: true },
  defaults: undefined,
};

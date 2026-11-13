import type { HubColumnDef, HubScreenDefs } from '../hubFields';

/** CI's hard-coded ids: the part-time employee type and the hourly salary basis (SSAVHOURLY). */
export const PART_TIME_TYPE = '2164';
export const HOURLY_BASIS = '52832';

const partTime = (v: Record<string, string | boolean>) => String(v.EMP_TYPE_ID) === PART_TIME_TYPE;

/** `flags` key of a Former employee (EMSF): adding a job for them offers "Is Rejoin" (CI job_mst initForm). */
export const formerFlag = (employeeId: string | boolean | number | undefined) => `former:${String(employeeId ?? '')}`;
/** Set by the screen's read() on the values of a stored job: the rejoin choice belongs to adding a job only. */
export const STORED_JOB = 'JOB_ID';

/** The columns of CI's job_mst_vw that HR reads (ids, the cost-centre code and the payslip password left out). */
export const JOB_COLUMNS: HubColumnDef[] = [
  { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
  { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NM', sortable: true },
  { key: 'EMP_GROSS_SALARY', header: 'Gross Salary', sortable: true },
  { key: 'CURRENCY_NM', header: 'Currency' },
  { key: 'STATUS_NAME', header: 'Status Name', sortable: true },
  { key: 'TYPE_NAME', header: 'Type Name', sortable: true },
  { key: 'DEPARTMENT_NAME', header: 'Department', sortable: true },
  { key: 'DESIGNATION_NAME', header: 'Designation', sortable: true },
  { key: 'HOLIDAY_GRP', header: 'Holiday Group' },
  { key: 'JOB_TITLE', header: 'Job Title', sortable: true },
  { key: 'JOB_CATEGORY', header: 'Job Category' },
  { key: 'WORK_STATION', header: 'Work Station' },
  { key: 'EMP_BAND', header: 'Emp Band' },
  { key: 'DATE_OF_JOINING', header: 'Date of Joining', format: 'date', sortable: true },
  { key: 'IS_REJOIN', header: 'Is Rejoin' },
  { key: 'COST_CENTER_NAME', header: 'Cost Center', sortable: true },
  { key: 'CONFIRMATION_DATE', header: 'Confirmation Date', format: 'date', sortable: true },
  { key: 'LAST_APPRAISAL_DATE', header: 'Last Appraisal Date', format: 'date', sortable: true },
  { key: 'WORK_LOCATION', header: 'Work Location', sortable: true },
  { key: 'OA_BRAND_CD', header: 'Brand' },
  { key: 'POSTION_NM', header: 'Position' },
  { key: 'PAYMENT_METHOD_NM', header: 'Payment Method' },
  { key: 'BASIC_HOURLY', header: 'Basic Hourly' },
  { key: 'BASIC_DAILY', header: 'Basic Daily' },
  { key: 'MAX_HOURS_AGREED', header: 'Max Hours Agreed' },
  { key: 'BASIC_MONTHLY', header: 'Basic Monthly' },
  { key: 'PAYROLL_START_DATE', header: 'Payroll Start Date', format: 'date', sortable: true },
  { key: 'AUTO_PAY_NUMBER', header: 'Auto Pay Number' },
  { key: 'COMMITED_HOURS', header: 'Committed Hours' },
  { key: 'MEDICLAIM', header: 'MEDICLAIM' },
  { key: 'SALARY_CALC_BASIS_NM', header: 'Salary Calculation Basis' },
  { key: 'NEW_REGIME', header: 'New Regime' },
];

/** CI job/job_mst — an employee's job record (columns of job_mst_vw). */
export const jobMstDefs: HubScreenDefs = {
  fields: [
    // CI: shown when adding a job for a Former employee; ticked, the save brings them back (screens/job_mst.ts).
    {
      name: 'IS_REJOIN', label: 'Is Rejoin', type: 'checkbox', attribute: 'IS_REJOIN',
      hidden: (v, flags) => STORED_JOB in v || !flags[formerFlag(v.EMP_ID)],
    },
    { name: 'DATE_OF_JOINING', label: 'Date of Joining', type: 'date', required: true, attribute: 'DATE_OF_JOINING' },
    { name: 'PAYROLL_START_DATE', label: 'Payroll Start Date', type: 'date', attribute: 'PAYROLL_START_DATE' },
    { name: 'EMP_TYPE_ID', label: 'Employee Type', type: 'select', required: true, options: 'empTypes', attribute: 'TYPE_NAME' },
    { name: 'EMP_STATUS_ID', label: 'Employee Status', type: 'select', required: true, options: 'statuses', dependsOn: 'EMP_TYPE_ID', attribute: 'STATUS_NAME' },
    { name: 'EMP_auto_pay_no', label: 'Auto Pay Number', type: 'text', max: 20, attribute: 'AUTO_PAY_NUMBER' },
    { name: 'EMP_payslip_pdf_password', label: 'Payslip PDF Password', type: 'text', max: 100, attribute: 'PAYSLIP_PDF_PASSWORD' },
    {
      name: 'max_hrs_agreed', label: 'Max Hours Agreed', type: 'text', max: 10, attribute: 'MAX_HOURS_AGREED',
      required: (v) => partTime(v), hidden: (v) => !partTime(v),
    },
    {
      name: 'EMP_grossy_salary', label: 'Gross Salary', type: 'text', max: 9, attribute: 'EMP_GROSS_SALARY',
      required: (v) => !partTime(v), hidden: (v) => partTime(v),
    },
    {
      name: 'EMP_basic_hourly', label: 'Basic Hourly', type: 'text', max: 12, attribute: 'BASIC_HOURLY',
      required: (v) => partTime(v), readOnly: (v) => !partTime(v),
      placeholder: 'Worked out from the gross salary when saved',
    },
    { name: 'EMP_basic_daily', label: 'Basic Daily', type: 'text', attribute: 'BASIC_DAILY', readOnly: () => true, hidden: (v) => partTime(v) },
    { name: 'EMP_basic_monthly', label: 'Basic Monthly', type: 'text', attribute: 'BASIC_MONTHLY', readOnly: () => true, hidden: (v) => partTime(v) },
    { name: 'CURRENCY_ID', label: 'Currency', type: 'select', required: true, options: 'currencies', attribute: 'CURRENCY_NM' },
    { name: 'payment_method', label: 'Payment Method', type: 'select', options: 'paymentMethods', attribute: 'PAYMENT_METHOD_NM' },
    { name: 'salaryCalcBasis', label: 'Salary Calculation Basis', type: 'select', required: true, options: 'salaryBases', attribute: 'SALARY_CALC_BASIS_NM' },
    {
      name: 'Emp_commited_hours', label: 'Committed Hours', type: 'text', max: 9, attribute: 'COMMITED_HOURS',
      hidden: (v) => String(v.salaryCalcBasis) !== HOURLY_BASIS,
    },
    { name: 'Emp_mediclaim', label: 'MEDICLAIM', type: 'text', max: 12, attribute: 'MEDICLAIM' },
    { name: 'department', label: 'Department', type: 'select', required: true, options: 'departments', attribute: 'DEPARTMENT_NAME' },
    { name: 'WORK_LOCATION', label: 'Work Location', type: 'select', required: true, options: 'workLocations', attribute: 'WORK_LOCATION' },
    { name: 'DESIGNATION', label: 'Designation', type: 'select', required: true, options: 'designations', attribute: 'DESIGNATION_NAME' },
    { name: 'JOB_CAT_ID', label: 'Job Category', type: 'select', options: 'jobCategories', attribute: 'JOB_CATEGORY' },
    { name: 'JOB_TITLE_ID', label: 'Job Title', type: 'select', options: 'jobTitles', attribute: 'JOB_TITLE' },
    { name: 'POSITION_ID', label: 'Position', type: 'select', options: 'positions', attribute: 'POSTION_NM' },
    { name: 'EMP_BAND_ID', label: 'Band', type: 'select', options: 'bands', attribute: 'EMP_BAND' },
    { name: 'EMP_GRADE_ID', label: 'Employee Grade', type: 'select', options: 'grades', attribute: 'EMP_GRADE' },
    {
      name: 'CONFIRMATION_DATE', label: 'Confirmation Date', type: 'date', attribute: 'CONFIRMATION_DATE',
      placeholder: 'Left empty: the joining date plus the brand\'s probation period',
    },
    { name: 'LAST_APPRAISAL_DATE', label: 'Last Appraisal Date', type: 'date', attribute: 'LAST_APPRAISAL_DATE' },
    { name: 'APPRAISAL_TYPE', label: 'Appraisal Type', type: 'select', options: 'appraisalTypes', attribute: 'APPRAISAL_TYPE_NM' },
    { name: 'HOLIDAY_GRP_ID', label: 'Holiday Group', type: 'select', required: true, options: 'holidayGroups', attribute: 'HOLIDAY_GRP' },
    { name: 'WORK_STATION', label: 'Work Station', type: 'text', max: 100, attribute: 'WORK_STATION' },
    { name: 'ACHIEVEMENT_INFO', label: 'Achievement Job Description', type: 'textarea', max: 4000, attribute: 'ACHIEVEMENT_INFO' },
    { name: 'costCenter', label: 'Cost Center', type: 'select', options: 'costCenters', attribute: 'COST_CENTER_NAME' },
  ],
  columns: JOB_COLUMNS,
};

/** CI job/job_mst/probation — employees still on probation, oldest confirmation first. */
export const jobProbationDefs: HubScreenDefs = {
  fields: [],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NM', sortable: true },
    { key: 'DATE_OF_JOINING', header: 'Date of Joining', format: 'date', sortable: true },
    { key: 'CONFIRMATION_DATE', header: 'Confirmation Date', format: 'date', sortable: true },
    { key: 'STATUS_NAME', header: 'Status Name' },
    { key: 'TYPE_NAME', header: 'Type Name', sortable: true },
    { key: 'DEPARTMENT_NAME', header: 'Department', sortable: true },
    { key: 'DESIGNATION_NAME', header: 'Designation', sortable: true },
    { key: 'WORK_LOCATION', header: 'Work Location', sortable: true },
    { key: 'LAST_APPRAISAL_DATE', header: 'Last Appraisal Date', format: 'date', sortable: true },
    { key: 'OA_BRAND_CD', header: 'Brand' },
  ],
  editsWith: 'job_mst',
};

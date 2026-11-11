import type { HubScreenDefs } from '../hubFields';

/**
 * CI employeeMngt/emp_hrprocess ("Employee Details", Payroll) — each employee's current job with what payroll reads
 * from it, and what is missing. A worklist: Edit opens Job Detail; the row menu opens the employee's other records.
 * The payroll columns use attributes emp_hrprocess_vw does not have, so Form Settings never hides them.
 */
export const empHrprocessDefs: HubScreenDefs = {
  fields: [],
  editsWith: 'job_mst',
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Name', sortable: true },
    { key: 'EMP_INITIALS', header: 'Employee Initials' },
    { key: 'DOB', header: 'Date of Birth', format: 'date', sortable: true },
    { key: 'GENDER', header: 'Gender', sortable: true },
    { key: 'EMAIL_ADD', header: 'Email', sortable: true },
    { key: 'FULL_PHONE_NBR', header: 'Full Phone No' },
    { key: 'EMP_STATUS', header: 'Employee Status', sortable: true },
    { key: 'EMP_GROSS_SALARY', header: 'Gross Salary', attribute: 'PAY_GROSS', sortable: true },
    { key: 'CURRENCY_NM', header: 'Currency', attribute: 'PAY_CURRENCY', sortable: true },
    { key: 'JOB_STATUS', header: 'Job Status', attribute: 'PAY_JOB_STATUS', sortable: true },
    { key: 'DEPARTMENT_NAME', header: 'Department', attribute: 'PAY_DEPARTMENT', sortable: true },
    { key: 'DESIGNATION_NAME', header: 'Designation', attribute: 'PAY_DESIGNATION', sortable: true },
    { key: 'DATE_OF_JOINING', header: 'Date of Joining', attribute: 'PAY_DOJ', format: 'date', sortable: true },
    { key: 'MISSING', header: 'Missing for Payroll', attribute: 'PAY_MISSING' },
  ],
};

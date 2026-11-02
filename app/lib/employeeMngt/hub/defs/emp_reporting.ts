import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/emp_reporting — who an employee reports to (columns of emp_reporting_vw). */
export const empReportingDefs: HubScreenDefs = {
  fields: [
    { name: 'MANAGER_ID', label: 'Manager', type: 'select', required: true, options: 'managers', attribute: 'MANAGER_NAME' },
    { name: 'MANAGER_TYPE_ID', label: 'Manager Type', type: 'select', required: true, options: 'managerTypes', attribute: 'MANAGER_TYPE' },
    { name: 'REPORTING_MODE_ID', label: 'Reporting Mode', type: 'select', required: true, options: 'reportingModes', attribute: 'REPORTING_MODE' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NAME', sortable: true },
    { key: 'MANAGER_NAME', header: 'Manager Name', sortable: true },
    { key: 'DEPARTMENT_NAME', header: 'Department', sortable: true },
    { key: 'DESIGNATION_NAME', header: 'Designation', sortable: true },
    { key: 'MANAGER_TYPE', header: 'Manager Type', sortable: true },
    { key: 'REPORTING_MODE', header: 'Reporting Mode', sortable: true },
  ],
};

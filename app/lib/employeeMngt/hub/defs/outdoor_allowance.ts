import type { HubScreenDefs } from '../hubFields';

/** CI outdoor_allowance/outdoor_allowance — an employee's postings that earn the outdoor allowance (columns of outdoor_allowance_vw). */
export const outdoorAllowanceDefs: HubScreenDefs = {
  employeeLabel: 'Employee Full Name',
  fields: [
    { name: 'outdoor_allowance_location', label: 'Outdoor Allowance Location', type: 'text', required: true, max: 100, attribute: 'OD_ALLOWANCE_LOC' },
    { name: 'startDate', label: 'Start Date', type: 'date', required: true, attribute: 'START_DATE' },
    { name: 'endDate', label: 'End Date', type: 'date', required: true, attribute: 'END_DATE' },
    { name: 'is_eligible_ODA', label: 'Is Eligible For Outdoor Allowance', type: 'checkbox', attribute: 'IS_ELIGIBLE_ODA' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Full Name', attribute: 'EMPLOYEE_NM', sortable: true },
    { key: 'OD_ALLOWANCE_LOC', header: 'Outdoor Allowance Location', sortable: true },
    { key: 'START_DATE', header: 'Start Date', format: 'date', sortable: true },
    { key: 'END_DATE', header: 'End Date', format: 'date', sortable: true },
    { key: 'IS_ELIGIBLE_ODA', header: 'Is Eligible For Outdoor Allowance', sortable: true },
  ],
};

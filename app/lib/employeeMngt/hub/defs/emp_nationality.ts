import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/emp_nationality — an employee's nationalities (columns of oa_contact_nationality_vw). */
export const empNationalityDefs: HubScreenDefs = {
  fields: [
    { name: 'CNTCT_NATIONALITY_ID', label: 'Nationality', type: 'select', required: true, options: 'countries', attribute: 'CNTCT_NATIONALITY_NM' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Full Name', attribute: 'CNTCT_NM', sortable: true },
    { key: 'CNTCT_NATIONALITY_NM', header: 'Nationality', sortable: true },
  ],
};

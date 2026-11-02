import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/empReportingLocations — where an employee works (columns of emp_reporting_locations_vw). */
export const empReportingLocationsDefs: HubScreenDefs = {
  fields: [
    { name: 'LOCATION_ID', label: 'Location', type: 'select', required: true, options: 'locations', attribute: 'LOCATION' },
    { name: 'IS_PRIMARY', label: 'Is Primary', type: 'checkbox', attribute: 'IS_PRIMARY' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Full Name', attribute: 'EMP_NAME', sortable: true },
    { key: 'LOCATION', header: 'Location', sortable: true },
    { key: 'IS_PRIMARY', header: 'Is Primary', sortable: true },
    { key: 'OA_BRAND_CD', header: 'Brand' },
  ],
  canDeleteRow: (row) => row.IS_PRIMARY !== 'Yes',
};

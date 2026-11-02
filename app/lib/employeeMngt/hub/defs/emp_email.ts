import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/emp_email — an employee's e-mail addresses (columns of oa_contact_emails_vw). */
export const empEmailDefs: HubScreenDefs = {
  fields: [
    { name: 'email', label: 'Contact Email', type: 'email', required: true, max: 100, attribute: 'CNTCT_EMAIL' },
    { name: 'EML_TYP', label: 'Email Type', type: 'select', options: 'emailTypes', attribute: 'EMAIL_TYP_NM' },
    { name: 'is_primary', label: 'Is Primary', type: 'checkbox', attribute: 'Is_Primary' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Contact Name', attribute: 'CNTCT_NM', sortable: true },
    { key: 'CNTCT_EMAIL', header: 'Contact Email', sortable: true },
    { key: 'EMAIL_TYP_NM', header: 'Email Type', sortable: true },
    { key: 'Is_Primary', header: 'Is Primary', sortable: true },
    { key: 'IS_EMP', header: 'Is Employee' },
    { key: 'OA_BRAND_CD', header: 'Brand' },
  ],
  canDeleteRow: (row) => row.Is_Primary !== 'Yes',
};

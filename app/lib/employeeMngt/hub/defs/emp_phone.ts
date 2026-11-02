import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/emp_phone — an employee's phone numbers (columns of oa_contact_phones_vw). */
export const empPhoneDefs: HubScreenDefs = {
  fields: [
    { name: 'COUNTRY_CODE', label: 'Country Code', type: 'select', required: true, options: 'countryCodes', attribute: 'COUNTRY_CODE' },
    { name: 'phone', label: 'Phone', type: 'text', required: true, max: 15, attribute: 'EMP_PHONE' },
    { name: 'phone_typ', label: 'Phone Type', type: 'select', options: 'phoneTypes', attribute: 'PHONE_TYPE' },
    { name: 'is_primary', label: 'Is Primary', type: 'checkbox', attribute: 'Is_Primary' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Full Name', sortable: true },
    { key: 'Is_Primary', header: 'Is Primary', sortable: true },
    { key: 'EMP_PHONE', header: 'Employee Phone', sortable: true },
    { key: 'PHONE_TYPE', header: 'Phone Type', sortable: true },
    { key: 'OA_BRAND_CD', header: 'Brand' },
  ],
  canDeleteRow: (row) => row.Is_Primary !== 'Yes',
};

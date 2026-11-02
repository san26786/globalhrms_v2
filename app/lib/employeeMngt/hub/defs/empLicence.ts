import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/empLicence — an employee's licences (columns of emp_licence_vw). */
export const empLicenceDefs: HubScreenDefs = {
  fields: [
    { name: 'licemceType', label: 'License Type', type: 'select', options: 'licenceTypes', attribute: 'LICENSE_TYP_NM' },
    { name: 'licemceTypenm', label: 'License Name', type: 'select', required: true, options: 'licenceNames', attribute: 'LICENSE__NAME' },
    { name: 'licenceNo', label: 'License No', type: 'text', required: true, max: 30, attribute: 'LICENSE_NO' },
    { name: 'licenceIssuedDate', label: 'License Issued Date', type: 'date', attribute: 'LICENSE_ISSUED_DATE' },
    { name: 'licenceExpiryDate', label: 'License Expiry Date', type: 'date', attribute: 'LICENSE_EXPIRY_DATE' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Full Name', attribute: 'EMP_NAME', sortable: true },
    { key: 'LICENSE_TYP_NM', header: 'License Type Name', sortable: true },
    { key: 'LICENSE__NAME', header: 'License Name', sortable: true },
    { key: 'LICENSE_NO', header: 'License No' },
    { key: 'LICENSE_ISSUED_DATE', header: 'License Issued Date', format: 'date', sortable: true },
    { key: 'LICENSE_EXPIRY_DATE', header: 'License Expiry Date', format: 'date', sortable: true },
  ],
};

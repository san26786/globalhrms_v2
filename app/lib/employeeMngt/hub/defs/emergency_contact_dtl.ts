import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/emergency_contact_dtl — an employee's emergency contacts (columns of emergency_contact_dtl_vw). */
export const emergencyContactDtlDefs: HubScreenDefs = {
  fields: [
    { name: 'emergContactId', label: 'Emergency Contact', type: 'select', options: 'relatives', attribute: 'EMRG_CNTCT_NM', placeholder: 'New person' },
    { name: 'firstName', label: 'First Name', type: 'text', required: true, max: 40 },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true, max: 40 },
    {
      name: 'emergContactRelationTypeId', label: 'Emergency Contact Relation Type', type: 'select', required: true, options: 'relations',
      attribute: 'EMERG_CONTACT_RELATION_TYPE_NM',
    },
    { name: 'MOBILE_COUNTRY_CODE', label: 'Phone Country Code', type: 'select', required: true, options: 'countryCodes', attribute: 'FULL_PHONE_NBR' },
    { name: 'emergContactMobileId', label: 'Phone Number', type: 'text', required: true, max: 15, attribute: 'FULL_PHONE_NBR' },
    { name: 'TEL_COUNTRY_CODE', label: 'Tel Country Code', type: 'select', options: 'countryCodes', attribute: 'FULL_TEL_NBR' },
    { name: 'emergContactTelId', label: 'Tel Number', type: 'text', max: 15, attribute: 'FULL_TEL_NBR' },
    { name: 'OFFICE_COUNTRY_CODE', label: 'Office Country Code', type: 'select', options: 'countryCodes', attribute: 'FULL_OFFICE_NBR' },
    { name: 'emergContactOffnoId', label: 'Office Number', type: 'text', max: 15, attribute: 'FULL_OFFICE_NBR' },
    { name: 'emergContactEmailId', label: 'Emergency Contact Email', type: 'email', required: true, max: 255 },
    { name: 'DOB', label: 'Date Of Birth', type: 'date' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NAME', sortable: true },
    { key: 'EMRG_CNTCT_NM', header: 'Emergency Contact Name', sortable: true },
    { key: 'EMERG_CONTACT_RELATION_TYPE_NM', header: 'Relationship', sortable: true },
    { key: 'FULL_PHONE_NBR', header: 'Full Phone Number' },
    { key: 'FULL_OFFICE_NBR', header: 'Full Office Number' },
    { key: 'FULL_TEL_NBR', header: 'Full Tel Number' },
    { key: 'OA_BRAND_CD', header: 'Brand' },
  ],
  employeeOptions: true,
  prefill: {
    field: 'emergContactId', extras: 'relatives',
    set: { firstName: 'firstName', lastName: 'lastName', DOB: 'dob', emergContactRelationTypeId: 'relation' },
  },
};

import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/immigration_dtl — an employee's visas, passports and permits (columns of immigration_dtl_vw). */
export const immigrationDtlDefs: HubScreenDefs = {
  fields: [
    { name: 'immgrationTypId', label: 'Immigration Type', type: 'select', required: true, options: 'immigrationTypes', attribute: 'IMMIGRATION_TYPE' },
    { name: 'immigrationNo', label: 'Immigration Number', type: 'text', required: true, max: 14, attribute: 'IMMIGRATION_NO' },
    { name: 'documentTitle', label: 'Document Title', type: 'text', max: 250, attribute: 'DOCUMENT_TITLE' },
    { name: 'userFile', label: 'Attachment', type: 'file', attribute: 'ATTACHMENT_NAME' },
    { name: 'issuingAuthority', label: 'Issuing Authority', type: 'text', max: 250, attribute: 'ISSUING_AUTHORITY' },
    { name: 'immgrationDateOfIssue', label: 'Date Of Issue', type: 'date', required: true, attribute: 'DATE_OF_ISSUE' },
    { name: 'immgrationDateOfExpiry', label: 'Date Of Expiry', type: 'date', required: true, attribute: 'DATE_OF_EXPIRY' },
    { name: 'immgrationProcessingCountryId', label: 'Processing Country', type: 'select', options: 'countries', attribute: 'PROCESSINGCOUNTRY_NM' },
    { name: 'issusefor', label: 'Issued For', type: 'select', options: 'countries', attribute: 'ISSUED_FOR_COUNTRY' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Full Name', attribute: 'EMP_NAME', sortable: true },
    { key: 'IMMIGRATION_TYPE', header: 'Immigration Type', sortable: true },
    { key: 'IMMIGRATION_NO', header: 'Document No' },
    { key: 'DATE_OF_ISSUE', header: 'Date Of Issue', format: 'date', sortable: true },
    { key: 'ISSUED_FOR_COUNTRY', header: 'Issued For Country' },
    { key: 'DOCUMENT_TITLE', header: 'Document Title' },
    { key: 'DATE_OF_EXPIRY', header: 'Date Of Expiry', format: 'date', sortable: true },
    { key: 'PROCESSINGCOUNTRY_NM', header: 'Processing Country' },
    { key: 'ISSUING_AUTHORITY', header: 'Issuing Authority' },
    { key: 'ATTACHMENT_NAME', header: 'Attachment' },
    { key: 'OA_BRAND_CD', header: 'Brand' },
  ],
};

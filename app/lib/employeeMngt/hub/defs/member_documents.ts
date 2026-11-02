import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/member_documents — an employee's documents (columns of member_attachment_vw). */
export const memberDocumentsDefs: HubScreenDefs = {
  fields: [
    { name: 'docCategory', label: 'Document Category', type: 'select', options: 'categories', attribute: 'DOC_CATEGORY' },
    {
      name: 'docSubCategory', label: 'Document Sub Category', type: 'select', options: 'subCategories', dependsOn: 'docCategory',
      attribute: 'DOC_SUB_CATEGORY',
    },
    { name: 'fileName', label: 'File Name', type: 'text', required: true, max: 50, attribute: 'FILENAME' },
    { name: 'userFile', label: 'Upload File', type: 'file', required: true, attribute: 'IMAGENAME' },
    { name: 'isPublic', label: 'Is Public (everyone in the brand sees it under Member Resources)', type: 'checkbox', attribute: 'IS_PUBLIC' },
    { name: 'userGroup', label: 'User Group', type: 'select', options: 'userGroups', attribute: 'USER_GROUP' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMPLOYEE_NM', sortable: true },
    { key: 'FILENAME', header: 'File Name', sortable: true },
    { key: 'IMAGENAME', header: 'Attachment' },
    { key: 'DOC_CATEGORY', header: 'Document Category', sortable: true },
    { key: 'DOC_SUB_CATEGORY', header: 'Document Sub Category' },
    { key: 'DOC_STATUS', header: 'Document Status' },
    { key: 'DOC_TYPE', header: 'Document Type', sortable: true },
    { key: 'USER_GROUP', header: 'User Group' },
    { key: 'IS_PUBLIC', header: 'Is Public' },
    { key: 'CREATED_ON', header: 'Uploaded On', format: 'date', sortable: true },
    { key: 'OA_BRAND_CD', header: 'Brand' },
  ],
  file: { required: true },
};

import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/emp_language — the languages an employee knows (columns of emp_language_vw). */
export const empLanguageDefs: HubScreenDefs = {
  fields: [
    { name: 'LANGUAGE_ID', label: 'Language', type: 'select', required: true, options: 'languages', attribute: 'LANGUAGE' },
    { name: 'LANGUAGE_COMPETENCY_ID', label: 'Language Competency', type: 'select', required: true, options: 'competencies', attribute: 'LANGUAGE_COMPETENCY' },
    { name: 'LANGUAGE_FLUENCY_ID', label: 'Language Fluency', type: 'select', required: true, options: 'fluencies', attribute: 'LANGUAGE_FLUENCY' },
    { name: 'COMMENTS', label: 'Additional Comments', type: 'textarea', max: 100, attribute: 'COMMENTS' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Full Name', attribute: 'EMP_NM', sortable: true },
    { key: 'LANGUAGE', header: 'Language', sortable: true },
    { key: 'LANGUAGE_FLUENCY', header: 'Fluency', sortable: true },
    { key: 'LANGUAGE_COMPETENCY', header: 'Competency', sortable: true },
    { key: 'OA_BRAND_CD', header: 'Brand' },
  ],
};

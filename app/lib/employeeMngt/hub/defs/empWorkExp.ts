import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/empWorkExp — an employee's previous jobs (columns of emp_work_experience_vw). */
export const empWorkExpDefs: HubScreenDefs = {
  fields: [
    { name: 'eexpSeqno', label: 'Experience Sequence No', type: 'text', max: 9, attribute: 'EEXP_SEQNO' },
    { name: 'eexpEmployer', label: 'Employer Name', type: 'text', max: 100, attribute: 'EEXP_EMPLOYER' },
    { name: 'jobTitleId', label: 'Job Role', type: 'select', required: true, options: 'jobRoles', attribute: 'JOB_TITLE' },
    { name: 'jobTitle', label: 'Job Title', type: 'text', required: true, max: 200, attribute: 'JOBTITLE' },
    { name: 'eexpFromDate', label: 'Start Date', type: 'date', attribute: 'EEXP_FROM_DATE' },
    { name: 'eexpToDate', label: 'End Date', type: 'date', attribute: 'EEXP_TO_DATE' },
    { name: 'eexpComments', label: 'Comments', type: 'textarea', max: 250, attribute: 'EEXP_COMMENTS' },
    { name: 'eexpInternal', label: 'Internal', type: 'checkbox', attribute: 'EEXP_INTERNAL' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Full Name', attribute: 'EMP_NAME', sortable: true },
    { key: 'EEXP_EMPLOYER', header: 'Employer Name', sortable: true },
    { key: 'JOB_TITLE', header: 'Job Role', sortable: true },
    { key: 'JOBTITLE', header: 'Job Title', sortable: true },
    { key: 'EEXP_FROM_DATE', header: 'Start Date', format: 'date', sortable: true },
    { key: 'EEXP_TO_DATE', header: 'End Date', format: 'date', sortable: true },
    { key: 'EEXP_INTERNAL', header: 'Internal' },
    { key: 'EEXP_SEQNO', header: 'Experience Sequence No', sortable: true },
    { key: 'OA_BRAND_CD', header: 'Brand' },
  ],
};

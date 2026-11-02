import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/emp_education — an employee's qualifications (columns of emp_education_vw). */
export const empEducationDefs: HubScreenDefs = {
  fields: [
    { name: 'EDU_QUAL_ID', label: 'Employee Qualification', type: 'select', required: true, options: 'qualificationLevels', attribute: 'EMP_GRADE' },
    {
      name: 'Education_Qualification', label: 'Education Qualification', type: 'select', required: true, options: 'qualifications',
      attribute: 'EDUCATION_QUALIFICATION',
    },
    { name: 'INSTITUTE', label: 'Institute', type: 'text', max: 100, attribute: 'institute' },
    { name: 'Education_Course_Type', label: 'Course Type', type: 'select', required: true, options: 'courseTypes', attribute: 'EDUCATION_COURSE_TYPE_NM' },
    { name: 'MAJOR', label: 'Major', type: 'text', max: 100, attribute: 'major' },
    { name: 'YEAR', label: 'Year Of Passing', type: 'text', required: true, max: 4, attribute: 'year' },
    { name: 'SCORE', label: 'Score', type: 'text', max: 20, attribute: 'score' },
    { name: 'START_DATE', label: 'Start Date', type: 'date', attribute: 'start_date' },
    { name: 'END_DATE', label: 'End Date', type: 'date', attribute: 'end_date' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Full Name', attribute: 'EMP_NM', sortable: true },
    { key: 'EMP_GRADE', header: 'Employee Qualification', sortable: true },
    { key: 'INSTITUTE', header: 'Institute', attribute: 'institute', sortable: true },
    { key: 'EDUCATION_QUALIFICATION', header: 'Education Qualification', sortable: true },
    { key: 'EDUCATION_COURSE_TYPE_NM', header: 'Course Type', sortable: true },
    { key: 'MAJOR', header: 'Major', attribute: 'major' },
    { key: 'YEAR', header: 'Year', attribute: 'year', sortable: true },
    { key: 'SCORE', header: 'Score', attribute: 'score' },
    { key: 'START_DATE', header: 'Start Date', attribute: 'start_date', format: 'date', sortable: true },
    { key: 'END_DATE', header: 'End Date', attribute: 'end_date', format: 'date', sortable: true },
    { key: 'OA_BRAND_CD', header: 'Brand' },
  ],
};

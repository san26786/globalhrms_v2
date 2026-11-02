import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/dependent_dtl — an employee's dependents (columns of dependent_dtl_vw). */
export const dependentDtlDefs: HubScreenDefs = {
  fields: [
    {
      name: 'oaDepCntctsId', label: 'Dependent Contact', type: 'select', options: 'relatives', attribute: 'OA_DEP_CNTCTS_ID',
      placeholder: 'New person',
    },
    { name: 'relationTypeId', label: 'Relation Type', type: 'select', required: true, options: 'relations', attribute: 'REALTION_TYPE_NAME' },
    { name: 'firstName', label: 'First Name', type: 'text', required: true, max: 40 },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true, max: 40 },
    { name: 'dateOfBirth', label: 'Date Of Birth', type: 'date', attribute: 'DATE_OF_BIRTH' },
    { name: 'age', label: 'Age', type: 'text', max: 3, attribute: 'AGE', placeholder: 'Worked out from the date of birth when given' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NAME', sortable: true },
    { key: 'CNTCT_FULL_NM', header: 'Dependent Full Name', sortable: true },
    { key: 'REALTION_TYPE_NAME', header: 'Relation Type', sortable: true },
    { key: 'DATE_OF_BIRTH', header: 'Date Of Birth', format: 'date', sortable: true },
    { key: 'AGE', header: 'Age', sortable: true },
    { key: 'OA_BRAND_CD', header: 'Brand' },
  ],
  employeeOptions: true,
  prefill: {
    field: 'oaDepCntctsId', extras: 'relatives',
    set: { firstName: 'firstName', lastName: 'lastName', dateOfBirth: 'dob', relationTypeId: 'relation' },
  },
};

import type { HubScreenDefs } from '../hubFields';

/**
 * CI form16/form16 ("Form 16") — the form's fields in CI initForm order and the columns of form16_vw (labels of the
 * form16 header scripts 242 / 294; visibility follows the brand's Form Settings of form16_vw). The address, postal
 * code, city and salary are read-only: CI's form16.js filled them from the chosen employee (the Form 16 page does).
 */
export const form16Defs: HubScreenDefs = {
  employeeLabel: 'Employee Name',
  employeeOptions: true,
  fields: [
    // CI getAssessmentYear() / getFinancialYear(): period_mst types 862 / 861.
    { name: 'PERIOD_ID', label: 'Period', type: 'select', options: 'assessmentYears', attribute: 'PERIOD_ID' },
    { name: 'FINANCIAL_PERIOD_ID', label: 'Financial Period', type: 'select', options: 'financialYears', attribute: 'FINANCIAL_PERIOD_ID' },
    { name: 'ADDRESS1', label: 'Address1', type: 'text', required: true, max: 255, readOnly: () => true, attribute: 'ADDRESS1' },
    { name: 'ADDRESS2', label: 'Address2', type: 'text', required: true, max: 255, readOnly: () => true, attribute: 'ADDRESS2' },
    { name: 'ADDRESS3', label: 'Address3', type: 'text', required: true, max: 255, readOnly: () => true, attribute: 'ADDRESS3' },
    { name: 'POSTAL_CODE', label: 'Postal Code', type: 'text', required: true, max: 9, readOnly: () => true, attribute: 'POSTAL_CODE' },
    { name: 'CITY', label: 'City', type: 'text', required: true, max: 255, readOnly: () => true, attribute: 'CITY' },
    { name: 'COUNTRY', label: 'Country', type: 'select', options: 'countries', required: true, attribute: 'COUNTRY' },
    { name: 'SALARY', label: 'Salary', type: 'number', max: 9, readOnly: () => true, attribute: 'SALARY' },
    { name: 'APPLICABLE_TAX', label: 'Applicable Tax', type: 'text', max: 255, attribute: 'APPLICABLE_TAX' },
    { name: 'PAN', label: 'Pan', type: 'text', required: true, max: 255, attribute: 'PAN' },
    { name: 'TAN', label: 'Tan', type: 'text', required: true, max: 255, attribute: 'TAN' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NM', sortable: true },
    // Hidden by default (Form Settings of form16_vw show them, e.g. brand GCON).
    { key: 'FORM16_ID', header: 'Form16 Id', attribute: 'FORM16_ID', sortable: true },
    { key: 'EMP_ID', header: 'Emp Id', attribute: 'EMP_ID', sortable: true },
    { key: 'PERIOD_NM', header: 'Period', attribute: 'PERIOD_NM', sortable: true },
    { key: 'FINANCIAL_PERIOD_NM', header: 'Financial Period', attribute: 'FINANCIAL_PERIOD_NM', sortable: true },
    { key: 'ADDRESS1', header: 'Address1', sortable: true },
    { key: 'ADDRESS2', header: 'Address2', sortable: true },
    { key: 'ADDRESS3', header: 'Address3', sortable: true },
    { key: 'POSTAL_CODE', header: 'Postal Code', sortable: true },
    { key: 'CITY', header: 'City', sortable: true },
    { key: 'COUNTRY', header: 'Country', attribute: 'COUNTRY' },
    { key: 'COUNTRY_NM', header: 'Country', attribute: 'COUNTRY_NM', sortable: true },
    { key: 'SALARY', header: 'Salary', sortable: true },
    { key: 'APPLICABLE_TAX', header: 'Applicable Tax', sortable: true },
    { key: 'PAN', header: 'Pan', sortable: true },
    { key: 'TAN', header: 'Tan', sortable: true },
    { key: 'OA_ID', header: 'Oa Id', attribute: 'OA_ID' },
    { key: 'USER_ID', header: 'User Id', attribute: 'USER_ID' },
  ],
};

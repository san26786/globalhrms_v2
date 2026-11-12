import type { HubScreenDefs } from '../hubFields';

/**
 * CI advance_salary/advance_salary — salary advances (columns of advance_salary_vw). The repayment schedule
 * (one instalment a month) is ticked Paid on the edit page's own panel.
 */
export const advanceSalaryDefs: HubScreenDefs = {
  employeeLabel: 'Employee',
  fields: [
    { name: 'MONTH_YEAR', label: 'Select Month', type: 'select', options: 'months', required: true, attribute: 'MONTH_YEAR' },
    { name: 'AMOUNT', label: 'Amount', type: 'number', required: true, max: 10, attribute: 'AMOUNT' },
    { name: 'NO_OF_INSTALLMENTS', label: 'No Of Installments', type: 'number', max: 2, placeholder: 'Automatic when left blank', attribute: 'NO_OF_INSTALLMENTS' },
    { name: 'COMMENT', label: 'Comment', type: 'text', required: true, max: 255, attribute: 'COMMENT' },
    // Worked out from the paid instalments.
    { name: 'TOTAL_DUE', label: 'Total Due', type: 'text', readOnly: () => true, attribute: 'TOTAL_DUE' },
    { name: 'TOTAL_PAID', label: 'Total Paid', type: 'text', readOnly: () => true, attribute: 'TOTAL_PAID' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NM', sortable: true },
    { key: 'ADVANCE_SALARY_ID', header: 'Advance Salary Id', sortable: true },
    { key: 'AMOUNT', header: 'Amount', sortable: true },
    { key: 'MONTH_YEAR', header: 'Month Year', sortable: true, sortKey: 'MONTH_KEY' },
    { key: 'NO_OF_INSTALLMENTS', header: 'No Of Installments', sortable: true },
    { key: 'COMMENT', header: 'Comment' },
    { key: 'TOTAL_DUE', header: 'Total Due', sortable: true },
    { key: 'TOTAL_PAID', header: 'Total Paid', sortable: true },
  ],
};

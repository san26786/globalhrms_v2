import type { HubScreenDefs } from '../hubFields';

/**
 * CI incentive/incentive — an employee's incentives and arrears for a pay month (columns of incentive_vw).
 * Generate Salary adds the month's total to the payslip line "Incentives/Arrears"; a negative arrear is a deduction.
 */
export const incentiveDefs: HubScreenDefs = {
  employeeLabel: 'Employee',
  fields: [
    { name: 'MONTH_YEAR', label: 'Month/Year', type: 'text', required: true, placeholder: 'MM/YYYY', attribute: 'DATE' },
    { name: 'INCENTIVE', label: 'Incentive', type: 'select', options: 'types', required: true, attribute: 'INCENTIVE' },
    // Text, not number: an arrear can be negative (a deduction).
    { name: 'AMOUNT', label: 'Amount', type: 'text', required: true, placeholder: '2500 or -1500.50 (negative for a deduction)', attribute: 'AMOUNT' },
    { name: 'COMMENTS', label: 'Comments', type: 'textarea', max: 500, attribute: 'COMMENTS' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee', attribute: 'EMP_NM', sortable: true },
    { key: 'DATE', header: 'Date', sortable: true, sortKey: 'PERIOD' },
    { key: 'INCENTIVE_NM', header: 'Incentive Name', sortable: true },
    { key: 'AMOUNT', header: 'Amount', sortable: true },
    { key: 'COMMENTS', header: 'Comments' },
    { key: 'PAID', header: 'Paid Flag', attribute: 'PAID_FLAG', sortable: true },
  ],
};

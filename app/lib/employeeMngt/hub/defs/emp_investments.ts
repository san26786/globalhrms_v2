import type { HubScreenDefs } from '../hubFields';

/**
 * CI employeeMngt/emp_investments — an employee's investment declaration per financial year (investment_mst_declaration_vw).
 * Form: Financial Year, and CI's read-only "Investment Amount" (TOTAL_DEDUCTION_AMOUNT, which CI never wrote: 0).
 * List: CI's Form Settings columns (Employee Code, Employee Name, Financial Year, Total Investment Amount, Total
 * Investment Benefit) — CI's list had no "Investment Amount" column.
 */
export const empInvestmentsDefs: HubScreenDefs = {
  fields: [
    { name: 'financial_year_id', label: 'Financial Year', type: 'select', required: true, options: 'financialYears', attribute: 'FINANCIAL_YEAR_NM' },
    { name: 'investment_amount', label: 'Investment Amount', type: 'number', readOnly: () => true, attribute: 'TOTAL_DEDUCTION_AMOUNT' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Full Name', attribute: 'EMP_NM', sortable: true },
    { key: 'FINANCIAL_YEAR_NM', header: 'Financial Year', sortable: true },
    { key: 'TOTAL_INVESTMENT_AMOUNT', header: 'Total Investment Amount', sortable: true },
    { key: 'ACTUAL_AMOUNT', header: 'Total Investment Benefit', sortable: true },
  ],
};

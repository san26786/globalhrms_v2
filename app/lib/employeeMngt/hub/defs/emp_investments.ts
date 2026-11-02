import type { HubScreenDefs } from '../hubFields';

/** CI employeeMngt/emp_investments — an employee's investment declaration per financial year (investment_mst_declaration_vw). */
export const empInvestmentsDefs: HubScreenDefs = {
  fields: [
    { name: 'financial_year_id', label: 'Financial Year', type: 'select', required: true, options: 'financialYears', attribute: 'FINANCIAL_YEAR_NM' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Full Name', attribute: 'EMP_NM', sortable: true },
    { key: 'FINANCIAL_YEAR_NM', header: 'Financial Year', sortable: true },
    { key: 'TOTAL_INVESTMENT_AMOUNT', header: 'Total Investment Amount', sortable: true },
    { key: 'ACTUAL_AMOUNT', header: 'Total Investment Benefit', sortable: true },
  ],
};

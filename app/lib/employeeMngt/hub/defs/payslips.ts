import type { HubColumnDef, HubScreenDefs } from '../hubFields';

/**
 * CI employeeMngt/emp_sal_component_mst (Payroll Processing) and …/paySlip (My Payslips): payslips — emp_basic_sal_mst
 * headers of SAL_TYPE PRSTPS (columns of emp_basic_sal_mst_vw). List-only: payslips are generated, marked paid,
 * viewed and deleted.
 */
const column = (key: string, header: string, extra: Partial<HubColumnDef> = {}): HubColumnDef => ({ key, header, attribute: key, ...extra });

const COMMON: HubColumnDef[] = [
  { key: 'EMP_NBR', header: 'Employee Number', sortable: true },
  { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NM', sortable: true },
  column('MONTH', 'Month', { sortable: true, sortKey: 'MONTH_N' }),
  column('YEAR', 'Year', { sortable: true, sortKey: 'YEAR_N' }),
  column('ACTUAL_AMOUNT', 'Actual Amount', { sortable: true, sortKey: 'ACTUAL_AMOUNT_N' }),
  column('EARNED_AMOUNT', 'Earned Amount', { sortable: true, sortKey: 'EARNED_AMOUNT_N' }),
  column('INCOME_TAX', 'Income Tax'),
  column('INCENTIVES_ARREARS', 'Incentives/Arrears'),
];

export const payrollProcessingDefs: HubScreenDefs = {
  fields: [],
  columns: [
    ...COMMON,
    column('TRANSACTION_STATUS', 'Transaction Status', { sortable: true, sortKey: 'TRANSACTION_STATUS_N' }),
    column('PAY_FREQUENCY', 'Pay Frequency', { sortable: true }),
    column('EMP_STATUS', 'Employee Status', { attribute: 'EMP_STATUS_ID', sortable: true }),
  ],
  // A paid payslip has reached the employee: mark it unpaid before deleting it.
  canDeleteRow: (row) => row.TRANSACTION_STATUS !== 'Paid',
};

export const myPayslipsDefs: HubScreenDefs = {
  fields: [],
  columns: COMMON,
};

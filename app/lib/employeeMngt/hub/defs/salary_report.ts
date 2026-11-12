import type { HubColumnDef, HubScreenDefs } from '../hubFields';

/**
 * CI employeeMngt/emp_sal_component_mst/viewMonthlySalaryReport ("Salary Report"): one month's payslips with the bank
 * account and the payable (net) amount. List-only.
 */
const column = (key: string, header: string, extra: Partial<HubColumnDef> = {}): HubColumnDef => ({ key, header, attribute: key, ...extra });

export const salaryReportDefs: HubScreenDefs = {
  fields: [],
  columns: [
    // EMPLOYEE_NBR is labelled "EMPLOYEENBR" in the live Form Settings: the column stays unbound.
    { key: 'EMP_NBR', header: 'Employee Number', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NM', sortable: true },
    column('ACCOUNT_NO', 'Bank Account No', { sortable: true }),
    column('EARNED_AMOUNT', 'Payable Amount', { sortable: true, sortKey: 'EARNED_AMOUNT_N' }),
    column('TRANSACTION_STATUS', 'Transaction Status', { sortable: true, sortKey: 'TRANSACTION_STATUS_N' }),
    column('EMP_STATUS', 'Employee Status', { attribute: 'EMP_STATUS_ID', sortable: true }),
  ],
};

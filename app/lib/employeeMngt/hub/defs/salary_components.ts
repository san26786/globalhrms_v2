import type { HubColumnDef, HubScreenDefs } from '../hubFields';

/**
 * CI employeeMngt/emp_sal_component_dtl ("Component Wise Salary Breakup", emp_basic_sal_dtl_vw): one row per payslip
 * line. List-only. Description, Comments, Component Type and Employee Status are unbound on purpose: their Form
 * Settings attributes carry raw labels ("COMPONENT_DESC", "COMMENTS") in every brand.
 */
const column = (key: string, header: string, extra: Partial<HubColumnDef> = {}): HubColumnDef => ({ key, header, attribute: key, ...extra });

export const salaryComponentsDefs: HubScreenDefs = {
  fields: [],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Number', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NM', sortable: true },
    column('MONTH', 'Month', { sortable: true, sortKey: 'MONTH_N' }),
    column('YEAR', 'Year', { sortable: true, sortKey: 'YEAR_N' }),
    column('SALARY_COMPONENT', 'Salary Component', { sortable: true }),
    { key: 'COMPONENT_TYPE', header: 'Component Type', sortable: true },
    column('ACTUAL_AMOUNT', 'Actual Amount', { sortable: true, sortKey: 'ACTUAL_AMOUNT_N' }),
    column('EARNED_AMOUNT', 'Earned Amount', { sortable: true, sortKey: 'EARNED_AMOUNT_N' }),
    { key: 'DESCRIPTION', header: 'Description' },
    { key: 'REMARKS', header: 'Comments' },
    column('PAY_FREQUENCY', 'Pay Frequency', { sortable: true }),
    { key: 'EMP_STATUS', header: 'Employee Status', sortable: true },
  ],
};

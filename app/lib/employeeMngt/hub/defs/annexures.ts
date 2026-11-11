import type { HubColumnDef, HubScreenDefs } from '../hubFields';

/**
 * CI employeeMngt/emp_sal_component_mst/indexAnnexures (Annexure Processing) and …/annexures (My Annexures):
 * salary annexures — an employee's salary structure, a yearly header and one of the brand's pay frequency
 * (columns of annexures_mst_vw). List-only: annexures are generated, marked current, viewed and deleted.
 */
const column = (key: string, header: string, extra: Partial<HubColumnDef> = {}): HubColumnDef => ({ key, header, attribute: key, ...extra });

const COMMON: HubColumnDef[] = [
  { key: 'EMP_NBR', header: 'Employee No', sortable: true },
  { key: 'EMP_FULL_NAME', header: 'Employee', attribute: 'EMP_NM', sortable: true },
  column('EMP_GRADE', 'Employee Grade', { sortable: true }),
  column('POSTION_NM', 'Position', { sortable: true }),
];
const AMOUNTS: HubColumnDef[] = [
  column('CURRENCY_NM', 'Currency', { sortable: true }),
  column('ACTUAL_AMOUNT', 'Actual Amount', { sortable: true, sortKey: 'ACTUAL_AMOUNT_N' }),
  column('EARNED_AMOUNT', 'Earned Amount', { sortable: true, sortKey: 'EARNED_AMOUNT_N' }),
  column('MONTH', 'Month', { sortable: true, sortKey: 'MONTH_N' }),
  column('YEAR', 'Year', { sortable: true, sortKey: 'YEAR_N' }),
  column('EFFECTIVE_DATE', 'Effective Date', { sortable: true, format: 'date' }),
];
// CI's Form Settings hid Is Current although Mark Current depends on it: an attribute the view lacks keeps it shown.
const CURRENT = column('IS_CURRENT_NM', 'Is Current', { attribute: 'IS_CURRENT_LIST', sortable: true });

/** The current annexure cannot be deleted (payroll would have none). */
const notCurrent = (row: Record<string, unknown>) => row.IS_CURRENT_NM !== 'Yes';

export const annexureProcessingDefs: HubScreenDefs = {
  fields: [],
  columns: [...COMMON, column('ACCOUNT_NO', 'Account No'), ...AMOUNTS, column('PAY_FREQUENCY', 'Pay Frequency', { sortable: true }), CURRENT, column('COMMENTS', 'Comments')],
  canDeleteRow: notCurrent,
};

export const myAnnexuresDefs: HubScreenDefs = {
  fields: [],
  columns: [...COMMON, ...AMOUNTS, CURRENT, column('COMMENTS', 'Comments')],
};

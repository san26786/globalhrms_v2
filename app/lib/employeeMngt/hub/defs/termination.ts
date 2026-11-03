import type { HubFormModel, HubValues } from '../hubTypes';
import type { HubScreenDefs } from '../hubFields';

/**
 * CI employeeMngt/termination — an employee's exits (columns of emp_termination_dtl_vw). The reason
 * decides the dates asked for: Employment Retained → the retention date; Rejoin (rows Job Detail's rejoin
 * wrote) → the rejoin date, read-only; any other → resigned on / accepted on / termination date.
 * `flags` carries "{code}:{reason id}" for the reasons the form treats apart (ETRER, ETRRJ).
 */
export const reasonIs = (code: 'ETRER' | 'ETRRJ') => (v: HubValues, flags: HubFormModel['flags']) => !!flags[`${code}:${v.EMP_TERMINATION_ID}`];
const retained = reasonIs('ETRER');
const rejoin = reasonIs('ETRRJ');
const noExitDates = (v: HubValues, flags: HubFormModel['flags']) => retained(v, flags) || rejoin(v, flags);

const money = (n: unknown) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const terminationDefs: HubScreenDefs = {
  employeeLabel: 'Employee Full Name',
  employeeOptions: true,
  fields: [
    { name: 'EMP_TERMINATION_ID', label: 'Termination Reason', type: 'select', options: 'reasons', required: true, attribute: 'EMP_TERMINATION' },
    { name: 'RETENTION_DATE', label: 'Retention Date', type: 'date', required: retained, hidden: (v, f) => !retained(v, f), attribute: 'RETENTION_DATE' },
    { name: 'REJOIN_DATE', label: 'Rejoin Date', type: 'date', hidden: (v, f) => !rejoin(v, f), readOnly: () => true, attribute: 'REJOIN_DATE' },
    { name: 'RESIGNED_ON', label: 'Resigned On', type: 'date', hidden: noExitDates, attribute: 'RESIGNED_ON' },
    { name: 'RESIGNATION_ACCEPTED_ON', label: 'Resignation Accepted On', type: 'date', hidden: noExitDates, attribute: 'RESIGNATION_ACCEPTED_ON' },
    { name: 'TERMINATION_DATE', label: 'Termination Date', type: 'date', hidden: noExitDates, attribute: 'TERMINATION_DATE' },
    { name: 'TERMINATION_COMMENTS', label: 'Comments', type: 'textarea', max: 4000, attribute: 'TERMINATION_COMMENTS' },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Full Name', attribute: 'EMP_NM', sortable: true },
    { key: 'EMP_TERMINATION', header: 'Employee Termination', sortable: true },
    { key: 'RESIGNED_ON', header: 'Resigned On', format: 'date', sortable: true },
    { key: 'RESIGNATION_ACCEPTED_ON', header: 'Resignation Accepted On', format: 'date', sortable: true },
    { key: 'TERMINATION_DATE', header: 'Termination Date', format: 'date', sortable: true },
    { key: 'RETENTION_DATE', header: 'Retention Date', format: 'date', sortable: true },
    { key: 'REJOIN_DATE', header: 'Rejoin Date', format: 'date' },
    { key: 'RESIGNATION_STATUS', header: 'Resignation Status', sortable: true },
    { key: 'TERMINATION_COMMENTS', header: 'Comments' },
  ],
  // CI getPendingMoney: dues the employee still has to clear (advisory, as CI).
  notices: (extras, v) => {
    const dues = extras.dues?.[String(v.EMP_ID)];
    if (!dues) return [];
    const out: string[] = [];
    if (Number(dues.loan) > 0) out.push(`${dues.name} has pending loans of ${money(dues.loan)} to clear.`);
    if (Number(dues.advance) > 0) out.push(`${dues.name} has an advance salary of ${money(dues.advance)} to clear.`);
    return out;
  },
};

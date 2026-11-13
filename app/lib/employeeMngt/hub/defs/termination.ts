import type { HubFormModel, HubValues } from '../hubTypes';
import type { HubScreenDefs } from '../hubFields';

/**
 * CI employeeMngt/termination — an employee's exits (columns of emp_termination_dtl_vw). The reason
 * decides the dates asked for: Employment Retained → the retention date; Rejoin (rows Job Detail's rejoin
 * wrote) → the rejoin date, read-only; any other → resigned on / accepted on / termination date.
 * `flags` carries "{code}:{reason id}" for the reasons the form treats apart (ETRER, ETRRJ). An empty
 * Termination Date is filled with Resignation Accepted On plus three months (CI termination.js): on save
 * by the server, and on the form as Resignation Accepted On is entered (computed).
 */
export const reasonIs = (code: 'ETRER' | 'ETRRJ') => (v: HubValues, flags: HubFormModel['flags']) => !!flags[`${code}:${v.EMP_TERMINATION_ID}`];
const retained = reasonIs('ETRER');
const rejoin = reasonIs('ETRRJ');
const noExitDates = (v: HubValues, flags: HubFormModel['flags']) => retained(v, flags) || rejoin(v, flags);

const money = (n: unknown) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** CI's notice period: the termination date is the resignation's acceptance date plus three months. */
export const NOTICE_MONTHS = 3;

/** `date` (YYYY-MM-DD) plus the notice period; the month's last day when the day overflows (as CI's moment().add). */
export function noticeEndDate(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  const end = new Date(Date.UTC(year, month - 1 + NOTICE_MONTHS, 1));
  end.setUTCDate(Math.min(day, new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()));
  return end.toISOString().slice(0, 10);
}

/**
 * CI termination.js (RESIGNATION_ACCEPTED_ON change): the Termination Date to fill while it is empty —
 * Resignation Accepted On plus three months — or null. For a form-side computed-field hook; the server
 * fills it on save (screens/termination.ts).
 */
export const terminationDateFill = (v: HubValues): string | null =>
  v.TERMINATION_DATE ? null : noticeEndDate(String(v.RESIGNATION_ACCEPTED_ON ?? ''));

export const terminationDefs: HubScreenDefs = {
  employeeLabel: 'Employee Full Name',
  employeeOptions: true,
  // CI termination.js: an empty Termination Date follows Resignation Accepted On (+3 months) as it is entered.
  computed: [{ field: 'TERMINATION_DATE', from: ['RESIGNATION_ACCEPTED_ON'], value: terminationDateFill }],
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

import type { HubFieldDef, HubScreenDefs } from '../hubFields';

/**
 * CI attndMngt/payroll_summary — an employee's attendance totals for a month (columns of
 * payroll_attendance_summary_vw). Salary generation reads Absent Days as loss-of-pay days when the employee
 * has no attendance register for the month.
 */
const count = (name: string, label: string, required = false): HubFieldDef => ({ name, label, type: 'number', required, attribute: name });

/** The day counts (at most the days of the month) and the hour counts. */
export const SUMMARY_DAYS = ['HALF_DAYS', 'FULL_DAYS', 'PAID_HOLIDAYS', 'ABSENT_DAYS', 'LEAVE_ADJUSTED', 'PAID_DAYS', 'WEEKLY_OFF', 'OTHER_HOLIDAY'];
export const SUMMARY_HOURS = ['WD_OT_HRS', 'HD_OT_HRS'];

const fields: HubFieldDef[] = [
  { name: 'MONTH_YEAR', label: 'Month / Year', type: 'text', required: true, placeholder: 'MM/YYYY', attribute: 'CALENDAR_MONTH' },
  { name: 'PAY_FREQUENCY', label: 'Pay Frequency', type: 'select', options: 'payFrequencies', attribute: 'PAY_FREQUENCY' },
  count('CALENDAR_WEEK', 'Calendar Week'),
  count('HALF_DAYS', 'Half Days', true),
  count('FULL_DAYS', 'Full Days'),
  count('PAID_HOLIDAYS', 'Paid Holidays'),
  count('ABSENT_DAYS', 'Absent Days'),
  count('LEAVE_ADJUSTED', 'Leave Adjusted'),
  count('WD_OT_HRS', 'Wd OT Hrs'),
  count('HD_OT_HRS', 'Hd OT Hrs'),
  count('PAID_DAYS', 'Paid Days'),
  { name: 'STATUS', label: 'Status', type: 'select', options: 'statuses', attribute: 'STATUS' },
  count('WEEKLY_OFF', 'Weekly Off'),
  count('OTHER_HOLIDAY', 'Other Holiday'),
];
const labelOf = (name: string) => fields.find((f) => f.name === name)!.label;

export const payrollSummaryDefs: HubScreenDefs = {
  employeeLabel: 'Employee',
  fields,
  columns: [
    { key: 'EMP_NBR', header: 'Employee Code', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NM', sortable: true },
    { key: 'MONTH_NAME', header: 'Month Name', sortable: true, sortKey: 'CALENDAR_MONTH' },
    { key: 'CALENDAR_YEAR', header: 'Calendar Year', sortable: true },
    { key: 'PAY_FREQUENCY_NM', header: 'Pay Frequency', attribute: 'PAY_FREQUENCY', sortable: true },
    { key: 'CALENDAR_WEEK', header: 'Calendar Week', sortable: true },
    ...['HALF_DAYS', 'FULL_DAYS', 'PAID_HOLIDAYS', 'ABSENT_DAYS', 'LEAVE_ADJUSTED', 'WD_OT_HRS', 'HD_OT_HRS', 'PAID_DAYS'].map((key) => ({
      key, header: labelOf(key), sortable: true,
    })),
    { key: 'STATUS_NM', header: 'Status', attribute: 'STATUS', sortable: true },
    { key: 'WEEKLY_OFF', header: 'Weekly Off', sortable: true },
    { key: 'OTHER_HOLIDAY', header: 'Other Holiday', sortable: true },
  ],
};

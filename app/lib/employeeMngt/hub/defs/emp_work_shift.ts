import type { HubScreenDefs } from '../hubFields';

/** CI shift type "Fixed" (RSTF): working hours per weekday; "Variable" has a start date and a number of days. */
export const FIXED_SHIFT = '4540';

const fixed = (v: Record<string, string | boolean>) => String(v.SHIFT_TYPE_ID) === FIXED_SHIFT;

/** CI employeeMngt/emp_work_shift — an employee's work shift (columns of emp_work_shift_vw). */
export const empWorkShiftDefs: HubScreenDefs = {
  fields: [
    { name: 'WORK_SHIFT_ID', label: 'Work Shift', type: 'select', required: true, options: 'shifts', attribute: 'WORK_SHIFT_ID' },
    { name: 'EFFECTIVE_ON', label: 'Effective On', type: 'date', required: true, attribute: 'EFFECTIVE_ON' },
    { name: 'SHIFT_CALENDAR_ID', label: 'Shift Calendar', type: 'select', options: 'calendars', attribute: 'SHIFT_CALENDAR_ID' },
    { name: 'SHIFT_TYPE_ID', label: 'Shift Type', type: 'select', required: true, options: 'shiftTypes', attribute: 'SHIFT_TYPE_ID' },
    { name: 'START_DATE', label: 'Start Date', type: 'date', required: (v) => !fixed(v), hidden: fixed },
    { name: 'NO_OF_DAYS', label: 'No of Days', type: 'text', max: 4, hidden: fixed, placeholder: 'Or give the end date' },
    { name: 'END_DATE', label: 'End Date', type: 'date', hidden: fixed },
    {
      name: 'hours', label: 'Hours', type: 'textarea', required: fixed, max: 400,
      placeholder: 'One line per day, e.g. "Mon 09:00-18:00", or a range: "Mon-Sat 10:00-19:00"',
    },
  ],
  columns: [
    { key: 'EMP_NBR', header: 'Employee Number', sortable: true },
    { key: 'EMP_FULL_NAME', header: 'Employee Name', attribute: 'EMP_NAME', sortable: true },
    { key: 'WORK_SHIFT', header: 'Work Shift', sortable: true },
    { key: 'SHIFT_TYPE', header: 'Shift Type', sortable: true },
    { key: 'EFFECTIVE_ON', header: 'Effective On', format: 'date', sortable: true },
    { key: 'HOURS', header: 'Hours' },
    { key: 'START_DATE', header: 'Start Date', format: 'date', sortable: true },
    { key: 'END_DATE', header: 'End Date', format: 'date', sortable: true },
    { key: 'NO_OF_DAYS', header: 'No of Days', sortable: true },
    { key: 'SHIFT_CALENDAR', header: 'Shift Calendar' },
    { key: 'OA_BRAND_CD', header: 'Brand' },
  ],
};

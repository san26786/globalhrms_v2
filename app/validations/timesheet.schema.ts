import { z } from 'zod';

/**
 * Timesheet input schemas — CI timesheet/timesheet::setFormValidationRules and the list / dialog
 * actions. The service adds the database rules (period already used, employee synchronised, scope).
 * Field names are the timesheet columns, so server errors land on the matching form inputs.
 */

const blankToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const requiredId = (label: string) =>
  z.coerce.number({ message: `${label} is required.` }).int(`${label} is required.`).positive(`${label} is required.`);
const optionalId = z.preprocess(blankToUndefined, z.coerce.number().int().nonnegative().optional());
const day = (label: string) =>
  z.string({ message: `${label} is required.` }).trim().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a valid date.`);

/** CI: totalduration / tottsdurationunit / comment required on both add and edit. */
const common = {
  TOT_TS_DURATION: z.coerce
    .number({ message: 'Default Timesheet Duration is required.' })
    .int('Default Timesheet Duration must be a whole number.')
    .min(0, 'Default Timesheet Duration cannot be negative.')
    .max(10000, 'Default Timesheet Duration is too large.'),
  TOT_TS_DURATIONID: requiredId('Duration Unit'),
  COMMENT: z.string({ message: 'Summary Comment is required.' }).trim().min(1, 'Summary Comment is required.').max(5000),
  TS_PRJ_ID: optionalId,
  TS_ACTIVITY_ID: optionalId,
};

/** CI insert rules: period and timesheet date required; the employee is chosen by administrators only. */
export const timesheetCreateSchema = z.object({
  ...common,
  TS_EMP_ID: optionalId,
  PERIOD_ID: requiredId('Period'),
  TS_DATE: z.preprocess(blankToUndefined, day('Timesheet Date').optional()),
});
export type TimesheetCreateInput = z.infer<typeof timesheetCreateSchema>;

/** CI update: employee and period cannot change (their inputs were disabled). */
export const timesheetUpdateSchema = z.object(common);
export type TimesheetUpdateInput = z.infer<typeof timesheetUpdateSchema>;

/** Approve / Reject: the approver's comment (CI approverComment, optional). */
export const decisionSchema = z.object({
  approverComment: z.preprocess((v) => (v == null ? '' : v), z.string().trim().max(5000)),
});

/** CI change_ts_status/{APR|RJT}: the selected timesheets. */
export const bulkStatusSchema = z.object({
  status: z.enum(['approve', 'reject']),
  ids: z
    .array(z.coerce.number().int().positive())
    .max(500, 'At most 500 timesheets can be updated at once.')
    .transform((ids) => [...new Set(ids)]),
});

/** CI autoGenerateTImesheet: employee and period. */
export const autoGenerateSchema = z.object({
  TS_EMP_ID: requiredId('Employee'),
  PERIOD_ID: requiredId('Timesheet Period'),
});

/** CI grantDelayedTimesheetPermission: employee, start (required), end (defaults to start), delayed flag. */
export const delayedPermissionSchema = z
  .object({
    TS_EMP_ID: requiredId('Employee'),
    START_DATE: day('Start Date'),
    END_DATE: z.preprocess(blankToUndefined, day('End Date').optional()),
    DELAYED_FLAG: z.preprocess((v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on', z.boolean()),
  })
  .transform((v) => ({ ...v, END_DATE: v.END_DATE ?? v.START_DATE }))
  .refine((v) => v.END_DATE >= v.START_DATE, { message: 'End Date cannot be before Start Date.', path: ['END_DATE'] });

// ------------------------------------------------------------------ timesheet items

const clock = (label: string) =>
  z.string({ message: `${label} is required.` }).trim().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, `${label} is required.`).transform((v) => v.slice(0, 5));

/**
 * CI timesheetItem::setFormValidationRules: timesheet (or, from New Timesheet Item, the date's
 * timesheet), date, start and end time required; end after start (CI duration "zeroValidate").
 * Duration and unit are worked out from the times on the server, as CI's form script did.
 */
export const timesheetItemSchema = z
  .object({
    TS_ID: optionalId,
    TS_DATE: day('Timesheet Date'),
    START_TIME: clock('Start Time'),
    END_TIME: clock('End Time'),
    TS_PRJ_ID: optionalId,
    TS_ACTIVITY_ID: optionalId,
    COMMENT: z.preprocess((v) => (v == null ? '' : v), z.string().trim().max(5000)),
  })
  .refine((v) => v.END_TIME > v.START_TIME, { message: 'End Time must be after Start Time.', path: ['END_TIME'] });
export type TimesheetItemInput = z.infer<typeof timesheetItemSchema>;

/** My Projects list actions (CI setEnabledProject / disableProject / setDefaultProject / setCurrentProjects). */
export const projectActionSchema = z.object({
  ids: z
    .array(z.coerce.number().int().positive())
    .max(500)
    .transform((ids) => [...new Set(ids)]),
  /** Administrators: the employee's user (CI T_EMP_ID); empty = the brand defaults (USER_ID 0). */
  userId: z.preprocess(blankToUndefined, z.coerce.number().int().nonnegative().optional()),
});

/**
 * CI timesheet_emp::update (setFormValidationRules + setFormControls): the employee code / name are
 * read-only (from the synced employee); Is Manager and the Manager (a timesheet employee) are editable.
 */
export const timesheetEmployeeUpdateSchema = z.object({
  IS_MANAGER: z.preprocess((v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on', z.boolean()),
  MANAGER_ID: optionalId,
});
export type TimesheetEmployeeUpdateInput = z.infer<typeof timesheetEmployeeUpdateSchema>;

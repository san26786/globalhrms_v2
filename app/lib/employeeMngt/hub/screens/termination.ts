import { noticeEndDate, terminationDefs } from '../defs/termination';
import { isoDate, masterName, softDeleteRow, type HubConfig, type HubContext } from '../hubEngine';
import type { HubValues } from '../hubTypes';
import { keepCurrent, masterLabel } from '../hubOptions';
import { afterTerminationDeleted, pendingDues, pendingSql, reasonFlags, reasonOptions, recomputeEmployeeStatus } from '../../termination';

/**
 * CI employeeMngt/termination ("Employee Termination"): an employee's exit records (table
 * emp_termination_dtl). Saving or deleting one updates the employee's job / employee / login status
 * (lib/employeeMngt/termination.ts); the list's Accept / Reject and Send Resignation Letter actions are
 * there too.
 *
 * As CI: only admins add, edit or delete (a normal user sends a resignation instead); the reason decides
 * the dates asked for; picking the employee warns of pending loans and advance salary. Behaviour changes:
 * the record is the employee's (CI gave a row an admin entered the admin's user and session brand, so the
 * employee never saw it); the comments are saved (CI showed them but never wrote them); Rejoin is not
 * offered for new records (CI saved nothing that made it one); the retention date is required for
 * Employment Retained, and the dates must be in order (CI's date rules did not exist); delete is soft.
 * As CI's form (termination.js), a new or changed Resignation Accepted On fills an empty Termination Date
 * with that date plus three months — here on save, so the date rules and the statuses see it (CI: in the
 * browser; the form shows it live once HubForm has a computed-field hook, see defs/termination.ts).
 */
/** The reasons without exit dates: Employment Retained and Rejoin. */
const noExitDates = (v: HubValues, flags: HubContext['flags']) =>
  !!flags[`ETRER:${v.EMP_TERMINATION_ID}`] || !!flags[`ETRRJ:${v.EMP_TERMINATION_ID}`];

/** CI termination.js: the date an empty Termination Date gets when Resignation Accepted On is entered or changed. */
function filledTerminationDate(v: HubValues, ctx: HubContext): string | null {
  if (v.TERMINATION_DATE || !v.RESIGNATION_ACCEPTED_ON || noExitDates(v, ctx.flags)) return null;
  if (ctx.existing && v.RESIGNATION_ACCEPTED_ON === ctx.existing.RESIGNATION_ACCEPTED_ON) return null;
  return noticeEndDate(String(v.RESIGNATION_ACCEPTED_ON));
}

const LIST_COLUMNS = `${masterName('t."EMP_TERMINATION_ID"')} AS "EMP_TERMINATION",
  ${isoDate('t."TERMINATION_DATE"')} AS "TERMINATION_DATE", ${isoDate('t."RESIGNED_ON"')} AS "RESIGNED_ON",
  ${isoDate('t."RESIGNATION_ACCEPTED_ON"')} AS "RESIGNATION_ACCEPTED_ON", ${isoDate('t."RETENTION_DATE"')} AS "RETENTION_DATE",
  ${isoDate('t."REJOIN_DATE"')} AS "REJOIN_DATE", t."TERMINATION_COMMENTS",
  CASE WHEN ${pendingSql('t')} THEN 'Pending' WHEN t."RESIGNATION_ACCEPTED_ON" IS NOT NULL THEN 'Accepted' END AS "RESIGNATION_STATUS"`;

export const terminationConfig: HubConfig = {
  key: 'termination',
  defs: terminationDefs,
  table: 'emp_termination_dtl',
  pk: 'TERMINATION_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: LIST_COLUMNS,
  search: ['EMP_TERMINATION', 'TERMINATION_DATE', 'RESIGNED_ON', 'RESIGNATION_STATUS', 'TERMINATION_COMMENTS'],
  sorts: ['EMP_TERMINATION', 'TERMINATION_DATE', 'RESIGNED_ON', 'RESIGNATION_ACCEPTED_ON', 'RETENTION_DATE', 'RESIGNATION_STATUS'],
  bind: {
    EMP_TERMINATION_ID: 'EMP_TERMINATION_ID', RETENTION_DATE: 'RETENTION_DATE', RESIGNED_ON: 'RESIGNED_ON',
    RESIGNATION_ACCEPTED_ON: 'RESIGNATION_ACCEPTED_ON', TERMINATION_DATE: 'TERMINATION_DATE', TERMINATION_COMMENTS: 'TERMINATION_COMMENTS',
  },
  deleteMode: 'soft',
  adminOnlyWrites: true,
  messages: {
    created: 'Successfully Added Employee Termination Details',
    updated: 'Successfully Updated Employee Termination Details',
    deleted: 'Successfully Deleted Employee Termination Details',
  },

  options: async (_subject, _brand, row) => ({
    reasons: await keepCurrent(await reasonOptions(), row?.EMP_TERMINATION_ID, masterLabel),
  }),
  flags: () => reasonFlags(),

  employeeOptions: async (employee) => ({
    options: {},
    extras: { dues: { [String(employee.id)]: { ...(await pendingDues(employee)), name: employee.name } } },
  }),

  // Written only by Job Detail's rejoin: shown, never saved here.
  read(row, values) {
    const rejoin = row.REJOIN_DATE;
    values.REJOIN_DATE = rejoin instanceof Date ? rejoin.toISOString().slice(0, 10) : '';
  },

  validate(v, check, ctx) {
    if (noExitDates(v, ctx.flags) || check.has('EMP_TERMINATION_ID')) return;
    const dates = ['RESIGNED_ON', 'RESIGNATION_ACCEPTED_ON', 'TERMINATION_DATE'];
    if (dates.some((d) => check.has(d))) return;
    // Records CI saved break these rules; they apply once a date or the reason changes.
    if (ctx.existing && ['EMP_TERMINATION_ID', ...dates].every((d) => v[d] === ctx.existing![d])) return;
    const resigned = String(v.RESIGNED_ON);
    const accepted = String(v.RESIGNATION_ACCEPTED_ON);
    const term = String(v.TERMINATION_DATE) || (filledTerminationDate(v, ctx) ?? '');
    if (!resigned && !term) check.fail('RESIGNED_ON', 'Enter the Resigned On date or the Termination Date.');
    if (resigned && accepted && accepted < resigned) {
      check.fail('RESIGNATION_ACCEPTED_ON', 'The Resignation Accepted On date cannot be before the Resigned On date.');
    }
    if (resigned && term && term < resigned) check.fail('TERMINATION_DATE', 'The Termination Date cannot be before the Resigned On date.');
  },

  extraColumns: (v, ctx) => {
    const filled = filledTerminationDate(v, ctx);
    return { EMP_NBR: ctx.employee.code, ...(filled ? { TERMINATION_DATE: filled } : {}) };
  },

  async afterWrite(tx, id, _v, ctx) {
    await recomputeEmployeeStatus(tx, ctx.employee.id, ctx.subject.userId, id);
  },

  async remove(tx, ctx) {
    await softDeleteRow(tx, 'emp_termination_dtl', 'TERMINATION_ID', ctx.id!, ctx.subject.userId);
    await afterTerminationDeleted(tx, ctx.employee.id, ctx.subject.userId);
  },
};

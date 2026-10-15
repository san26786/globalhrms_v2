import type { PendingCheck } from './period.types';

/**
 * Every CI constant of periodMngt/period_mst in one place (open/closed: a new period type check or
 * frequency is a row here, not a code change in the service).
 */

/** CI const_helper: PERIODTYPE = 43 (common_type OPT), PERIODSTATUS = 44 (OPS). */
export const PERIOD_TYPE_TYPE_CODE = 'OPT';
export const PERIOD_STATUS_TYPE_CODE = 'OPS';
export const PERIOD_TYPE_TYPE_ID = 43;
export const PERIOD_STATUS_TYPE_ID = 44;

/** CI periodStatus = 'OPSA' (Active), endProcedure's hard-coded 866 = OPSIA (Inactive). */
export const ACTIVE_STATUS_CODE = 'OPSA';
export const INACTIVE_STATUS_CODE = 'OPSIA';
export const INACTIVE_STATUS_FALLBACK_ID = 866;

/** CI setting SSACVPS: periods may be verified only once the period settings were verified. */
export const VERIFY_SETTING_CODE = 'SSACVPS';
/** CI setting SSABAN: the brand's application (getEnabledPeriodType). */
export const BRAND_APP_SETTING_CODE = 'SSABAN';

/** CI title codes / texts. */
export const LIST_TITLE_CODE = 'PMSMN';
export const TITLES = { add: 'Add New Period Master', edit: 'Edit Period Master' } as const;

/** CI verifyPeriod: where "verify period settings first" links to (Company Settings screen). */
export const SETTINGS_VERIFY_HREF = '/setting_manager/change_module_settings?screen=CS';

/**
 * CI getStartEndDate(): end = start + this (by the type's frequency setting, lower-cased).
 * Kept exactly as CI, including its quirks: weekly is "+7 days" (an 8-day period), and any other
 * frequency — quarterly, daily, none — is "+1 day".
 */
export const START_END_DIFF: Record<string, { years?: number; months?: number; days: number }> = {
  annually: { years: 1, days: -1 },
  'half annually': { months: 6, days: -1 },
  monthly: { months: 1, days: -1 },
  weekly: { days: 7 },
};
export const START_END_DIFF_DEFAULT = { days: 1 };

/**
 * CI endProcedure(): after a period is closed, pending rows of the module that uses it are reported
 * (the period is closed anyway). CI hard-coded the period type ids (864 / 1434 / 1435 / 1584) and the
 * status ids below; the type is matched here by its master code. CI read the *_vw views, which do not
 * exist in PostgreSQL — the same filters run on their base tables.
 */
export const PENDING_CHECKS: readonly PendingCheck[] = [
  {
    typeCode: 'OPTLP', // Leave Period (864)
    table: 'leave_requests_dtl',
    periodColumn: 'LEAVE_PERIOD_ID',
    statusColumn: 'LEAVE_STATUS',
    statusIds: [1301],
    message: 'Pending Leave requset(s) found',
  },
  {
    typeCode: 'OPTS', // Timesheet Period (1434)
    table: 'timesheet',
    periodColumn: 'PERIOD_ID',
    statusColumn: 'TS_STATUS_ID',
    statusIds: [715, 6970],
    message: 'Pending or Drafted Timesheet request(s) found',
  },
  {
    typeCode: 'OPAS', // Achievement Period (1435)
    table: 'achievment',
    periodColumn: 'PERIOD_ID',
    statusColumn: 'ACH_STATUS_ID',
    statusIds: [48940, 48944],
    message: 'Pending or Drafted Achievement requset(s) found',
  },
  {
    typeCode: 'PTOD', // OD Entry Period (1584)
    table: 'outdrentr',
    periodColumn: 'OD_PERIOD_ID',
    statusColumn: 'OD_STATUS',
    statusIds: [2190],
    message: 'Pending Outdoor requset(s) found',
  },
];

/** CI flash texts (spelling kept). */
export const MESSAGES = {
  added: 'Successfully Added Period Master',
  updated: 'Successfully Updated Period  Master',
  deleted: 'Successfully Deleted Period  Master',
  inUse: 'Cannot delete period. It is being used by other modules.',
  periodInUse: 'Period Already In Use',
  descExists: 'This Period Already Exists',
  selectToVerify: 'Please Select Period(s) to Verify',
  selectToLock: 'Please Select Period(s) to Lock',
  selectToUnlock: 'Please Select Period(s) to Unlock',
  verifySettingsFirst: 'Please verify period settings first.',
  verified: 'Successfully Verified Period.',
  locked: 'Period Locked Successfully',
  unlocked: 'Period Unlocked Successfully',
  selectLocked: 'Please Select Locked Period',
  verifySelected: 'Please Verify Selected Period(s)',
  ended: 'Successfully Ended Period.',
  noNewPeriod: 'No new period was generated.',
} as const;

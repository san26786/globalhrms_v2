/**
 * Timesheet (CI controllers/timesheet/timesheet.php + models/timesheet/timesheet_m.php) — codes and
 * paths. Master ids are always resolved from these codes (CI getMasterIDFromCode), never hard-coded.
 */

/** CI menu URL: its permission_dtl grant decides list / add / edit / delete. */
export const TIMESHEET_MENU = 'timesheet/timesheet';
/** CI timesheetItem menu: deleting an item from the timesheet form needed its delete grant. */
export const TIMESHEET_ITEM_MENU = 'timesheet/timesheetItem';

export const API = '/api/timesheet/timesheet';
export const PAGE = '/timesheet/timesheet';
export const TEAM_PAGE = '/timesheet/timesheet/team';
/** Timesheet Item screens (CI timesheet/timesheetItem — its own submodule). */
export const ITEM_PAGE = '/timesheet/timesheetItem';
export const ITEM_API = '/api/timesheet/timesheetItem';
/** CI new_timesheet_item: add an item for a date (the timesheet is found or created). */
export const NEW_ITEM_PAGE = '/timesheet/new_timesheet_item';
/** CI timesheetBlock ("Manage Timesheet" / "Submit for Approval Timesheet"). */
export const BLOCK_PAGE = '/timesheet/timesheet/timesheetBlock';
/** CI userProjects ("My Projects" / "Configure Projects"). */
export const PROJECTS_PAGE = '/timesheet/timesheet/userProjects';

/** common_type of the timesheet statuses (independent_mst TYP_CD 'TS'). */
export const STATUS_TYPE_CODE = 'TS';
export const STATUS = { draft: 'DRFT', pending: 'APPN', approved: 'APR', rejected: 'RJT' } as const;
export type StatusKey = keyof typeof STATUS;

/** Timesheet item statuses. */
export const ITEM_DRAFT = 'TMISDRFT';
export const ITEM_SUBMITTED = 'TMISSUB';

/** Duration units (type TDU). */
export const DURATION_UNIT_TYPE = 'TDU';
export const UNIT_HOURS = 'TDUH';
export const UNIT_MINUTES = 'TDUM';

/** Brand masters: projects (TP) and their tasks / activities (TA). */
export const PROJECT_TYPE = 'TP';
export const ACTIVITY_TYPE = 'TA';

/** Period type "Timesheet Period" and period statuses. */
export const PERIOD_TYPE = 'OPTS';
export const PERIOD_ACTIVE = 'OPSA';
export const PERIOD_INACTIVE = 'OPSIA';

/** Employee status "Current" (CI lists only current employees). */
export const EMP_CURRENT = 'EMSC';
/** Permission class "Managerial Service": sees the My Team links. */
export const MANAGER_CLASS = 'PCM';
/** Approved leave (leave_requests_dtl.LEAVE_STATUS). */
export const LEAVE_ACCEPTED = 'LEAC';

/** Brand settings read by the module. */
export const SETTING = {
  /** "Activity tab": show project / activity / duration and the items table on the form. */
  activityTab: 'SSAATAB',
  /** Delayed timesheet deduction: limits the periods a user may open and enables the permission dialog. */
  delayedDeduction: 'SSADTSD',
  /** Grace days for delayed timesheet entry. */
  graceDays: 'SSAGDDT',
  /** Weekly off days (checkbox). */
  weeklyOff: 'SSAWKO',
  /** Working days per week (Auto Generate's default duration). */
  workingDaysPerWeek: 'SSAWDPW',
} as const;

/** CI titles: getTitleByCode codes of the team lists, fixed texts of the own lists. */
export const TITLES = {
  own: { all: 'TIFE', pending: 'Pending Approval Timesheets', approved: 'Approved Timesheets', rejected: 'Rejected Timesheets' },
  team: { all: 'FMTTT', pending: 'FMMTTR', approved: 'FMTTA', rejected: 'FMTTR' },
} as const;

/** Committed hours per day when the employee's job has none (CI new_timesheet_item_m::createTimesheet). */
export const DEFAULT_COMMITTED_HOURS = 9;
/** timesheet.ACTIVITY_DURATION is DECIMAL(4,2). */
export const MAX_ACTIVITY_DURATION = 99.99;

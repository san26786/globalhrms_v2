import type { RequestSubject } from '@/lib/auth/getSubject';
import type { ListActionDefinition, ListScope } from '@/lib/listview/listDefinitions';
import { getMasterId } from '@/lib/masters/masterService';
import { getTitleByCode } from '@/lib/table-builder/getTitleByCode';
import { EMP_CURRENT, TITLES, type StatusKey } from './timesheet.constants';
import {
  delayedDeductionEnabled,
  employeeOptions,
  hasManagerClass,
  openPeriods,
  periodOptions,
  statusIds,
  type StatusIds,
} from './timesheet.lookups';

/**
 * Timesheet lists — CI timesheet/timesheet::index($status, $period) ("All Timesheet" and its
 * Approval Pending / Approved / Rejected tabs) and ::MyTeamTimesheet($status, $period). The status
 * is the CI master id (6970 …), so old URLs and menu entries keep working.
 */

const positive = (raw: string | undefined) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** ?status= → one of the four timesheet statuses, else none. */
function statusOf(raw: string | undefined, st: StatusIds): number | null {
  const id = positive(raw);
  return id && Object.values(st).includes(id) ? id : null;
}

/** CI index(): status / period filter, current employees only. */
export async function ownListScope(_subject: RequestSubject, query: Record<string, string>): Promise<ListScope> {
  const [st, current] = await Promise.all([statusIds(), getMasterId(EMP_CURRENT)]);
  const status = statusOf(query.status, st);
  const period = positive(query.period);
  return {
    equals: [
      ...(status ? [{ column: 'TS_STATUS_ID', value: status }] : []),
      ...(period ? [{ column: 'PERIOD_ID', value: period }] : []),
      ...(current ? [{ column: 'EMP_STATUS_ID', value: current }] : []),
    ],
  };
}

/** CI MyTeamTimesheet(): status / period filter; without a status every timesheet but drafts. */
export async function teamListScope(_subject: RequestSubject, query: Record<string, string>): Promise<ListScope> {
  const st = await statusIds();
  const status = statusOf(query.status, st);
  const period = positive(query.period);
  return {
    equals: [
      ...(status ? [{ column: 'TS_STATUS_ID', value: status }] : []),
      ...(period ? [{ column: 'PERIOD_ID', value: period }] : []),
    ],
    notEquals: status ? [] : [{ column: 'TS_STATUS_ID', value: st.draft }],
  };
}

/** CI timesheetItem::index(): the period dropdown filter (?period=). */
export async function itemListScope(_subject: RequestSubject, query: Record<string, string>): Promise<ListScope> {
  const period = positive(query.period);
  return { equals: period ? [{ column: 'PERIOD_ID', value: period }] : [] };
}

/**
 * What the list pages need besides the rows and buttons: the status tabs, per-tab titles and the
 * Timesheet Period filter. The buttons are listDefinitions `listActions` (GET /api/listview/{list}/actions).
 */
export interface TimesheetListMeta {
  statuses: StatusIds;
  /** List titles per status tab (CI fixed texts / getTitleByCode). */
  titles: Record<'all' | Exclude<StatusKey, 'draft'>, string>;
  periods: Array<{ value: number; label: string }>;
}

export async function listMeta(subject: RequestSubject, team: boolean): Promise<TimesheetListMeta> {
  const brandId = subject.oaBrandId;
  // CI: the team titles and the own list's "All" title come from getTitleByCode; the own status tabs are fixed texts.
  const byCode = async (code: string, fallback: string) => (await getTitleByCode(code))?.trim() || fallback;
  const titles = team
    ? [
        byCode(TITLES.team.all, 'Team Timesheets'),
        byCode(TITLES.team.pending, 'Team Pending Approval Timesheets'),
        byCode(TITLES.team.approved, 'Team Approved Timesheets'),
        byCode(TITLES.team.rejected, 'Team Rejected Timesheets'),
      ]
    : [byCode(TITLES.own.all, 'My Timesheet'), TITLES.own.pending, TITLES.own.approved, TITLES.own.rejected];
  const [statuses, periods, all, pending, approved, rejected] = await Promise.all([
    statusIds(),
    brandId ? openPeriods(brandId) : Promise.resolve([]),
    ...titles,
  ]);
  return {
    statuses,
    titles: { all, pending, approved, rejected },
    periods: periodOptions(periods),
  };
}

/* --------------------------------------------------------------------------- List buttons -- */

/** Files referenced by the buttons' `ref` documentation. */
const TS_FILES = {
  actionsRoute: 'app/api/timesheet/timesheet/actions/[action]/route.ts',
  service: 'app/lib/timesheet/timesheet.service.ts',
  lookups: 'app/lib/timesheet/timesheet.lookups.ts',
  schema: 'app/validations/timesheet.schema.ts',
};
const TS_ACTIONS_API = '/api/timesheet/timesheet/actions';

/** CI `0 === (int) $mstr_id || $mstr_id === APPN`: bulk approve / reject on the All and Pending tabs only. */
async function onAllOrPendingTab(_subject: RequestSubject, query: Record<string, string>): Promise<boolean> {
  const status = Number(query.status);
  return !status || status === (await statusIds()).pending;
}

const timesheetPeriodOptions = async (s: RequestSubject) => (s.oaBrandId ? periodOptions(await openPeriods(s.oaBrandId)) : []);
const timesheetEmployeeOptions = async (s: RequestSubject) => (s.oaBrandId ? employeeOptions(s.oaBrandId) : []);

/**
 * CI timesheet::index() / ::MyTeamTimesheet() $listActions, in CI order
 * (controllers/timesheet/timesheet.php) — used by listDefinitions `timesheet` / `timesheet_team`
 * listActions. Each entry carries its CI source, handler, service and files in `ref`. Every action
 * is enforced again on the server (timesheet.service: authorize() + the is_admin checks).
 */
export function timesheetListActions(team: boolean): ListActionDefinition[] {
  const page = team ? '/timesheet/timesheet/team' : '/timesheet/timesheet';
  const actions: ListActionDefinition[] = [
    {
      key: 'add',
      title: team ? 'Add New Timesheet' : 'Add New My Timesheet',
      icon: 'plus-circle',
      kind: 'link',
      href: `${page}/add`,
      permission: 'create',
      ref: {
        ci: team ? 'timesheet::newTimesheet/{period}/TEAM' : 'timesheet::newTimesheet',
        handler: 'timesheetService.create (POST /api/timesheet/timesheet, from the form)',
        service: 'timesheet.service → prisma.timesheet',
        files: [
          `app/(dashboard)${page}/add/page.tsx`,
          'app/(dashboard)/timesheet/timesheet/timesheetForm.tsx',
          'app/api/timesheet/timesheet/route.ts',
          TS_FILES.service,
        ],
      },
    },
  ];
  if (!team) {
    actions.push(
      {
        key: 'auto',
        title: 'Auto Generate Timesheet',
        icon: 'cog',
        kind: 'dialog',
        minAdminLevel: 1,
        request: { url: `${TS_ACTIONS_API}/auto-generate`, method: 'POST' },
        dialog: {
          title: 'Auto Generate Timesheet',
          submitText: 'Generate',
          fields: [
            { name: 'TS_EMP_ID', label: 'Employee', type: 'select', required: true, placeholder: 'Select Employee', options: timesheetEmployeeOptions },
            { name: 'PERIOD_ID', label: 'Timesheet Period', type: 'select', required: true, placeholder: 'Select Timesheet Period', options: timesheetPeriodOptions },
          ],
        },
        ref: {
          ci: 'timesheet::autoGenerateTImesheet (#auto_generate_modal)',
          handler: 'timesheetService.autoGenerate',
          service: 'timesheet.service → prisma.timesheet / timesheet_item from the punch records',
          files: [TS_FILES.actionsRoute, TS_FILES.service, `${TS_FILES.schema} (autoGenerateSchema)`],
        },
      },
      {
        key: 'delayed',
        title: 'Delayed Timesheet Permission',
        icon: 'clock',
        kind: 'dialog',
        minAdminLevel: 1,
        reload: false,
        visible: (s) => delayedDeductionEnabled(s.oaBrandId), // CI setting SSADTSD = 'Yes'
        request: { url: `${TS_ACTIONS_API}/delayed-permission`, method: 'POST' },
        dialog: {
          title: 'Delayed Timesheet Permission',
          submitText: 'Submit',
          fields: [
            { name: 'TS_EMP_ID', label: 'Employee', type: 'select', required: true, placeholder: 'Select Employee', options: timesheetEmployeeOptions },
            { name: 'START_DATE', label: 'Start Date', type: 'date', required: true },
            { name: 'END_DATE', label: 'End Date', type: 'date', minField: 'START_DATE' },
            { name: 'DELAYED_FLAG', label: 'Mark as Delayed (salary deduction applies)', type: 'checkbox' },
          ],
        },
        ref: {
          ci: 'timesheet::grantDelayedTimesheetPermission (#grant_delayed_permission_modal)',
          handler: 'timesheetService.grantDelayed',
          service: 'timesheet.service → delayed timesheet permission rows (CI delayed_timesheet_m)',
          files: [TS_FILES.actionsRoute, TS_FILES.service, `${TS_FILES.schema} (delayedPermissionSchema)`],
        },
      },
    );
  }
  actions.push({
    key: team ? 'own' : 'team',
    title: team ? 'View My Timesheets' : 'View My Team Timesheet',
    icon: team ? 'user' : 'users',
    kind: 'link',
    href: team ? '/timesheet/timesheet' : '/timesheet/timesheet/team',
    visible: (s) => hasManagerClass(s), // CI permission class code 'PCM'
    ref: {
      ci: team ? 'timesheet::index' : 'timesheet::MyTeamTimesheet',
      service: 'timesheet.lookups.hasManagerClass',
      files: [team ? 'app/(dashboard)/timesheet/timesheet/page.tsx' : 'app/(dashboard)/timesheet/timesheet/team/page.tsx', TS_FILES.lookups],
    },
  });
  for (const status of ['approve', 'reject'] as const) {
    actions.push({
      key: status,
      title: status === 'approve' ? 'Approve Selected Timesheet' : 'Reject Selected Timesheet',
      icon: status === 'approve' ? 'thumbs-up' : 'thumbs-down',
      kind: 'api',
      minAdminLevel: 1,
      visible: onAllOrPendingTab,
      request: { url: `${TS_ACTIONS_API}/status`, method: 'POST', body: { status } },
      selection: { column: 'TS_ID', emptyMessage: 'Please Select the TimeSheet' },
      ref: {
        ci: `timesheet::change_ts_status/${status === 'approve' ? 'APR' : 'RJT'}${team ? '/TEAM' : ''}`,
        handler: 'timesheetService.bulkStatus',
        service: 'timesheet.service → prisma.timesheet + timesheet action log',
        files: [TS_FILES.actionsRoute, TS_FILES.service, `${TS_FILES.schema} (bulkStatusSchema)`],
      },
    });
  }
  actions.push({
    key: 'period',
    title: 'Generate Timesheet Period',
    icon: 'upload',
    kind: 'api',
    minAdminLevel: 1,
    reloadPage: true, // the page's Timesheet Period filter lists the new periods
    request: { url: `${TS_ACTIONS_API}/generate-period`, method: 'POST' },
    ref: {
      ci: `timesheet::generatePeriod${team ? '/TEAM' : ''}`,
      handler: 'timesheetService.generatePeriods',
      service: 'lib/utilities/periodGenerator.generatePeriods → period_mst',
      files: [TS_FILES.actionsRoute, TS_FILES.service, 'app/lib/utilities/periodGenerator.ts'],
    },
  });
  return actions;
}

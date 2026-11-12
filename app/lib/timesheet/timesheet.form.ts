import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { ForbiddenError } from '@/lib/http/errors';
import type { FormConfig, FormPermissions } from '@/lib/form-init/initForm';
import type { FormButton, FormTable } from '@/lib/form-init/formExtras';
import { getMasterId } from '@/lib/masters/masterService';
import { timesheetCreateSchema, timesheetUpdateSchema } from '@/validations/timesheet.schema';
import { API, ITEM_API, ITEM_PAGE, UNIT_HOURS } from './timesheet.constants';
import {
  activityOptions,
  activityTabEnabled,
  currentProject,
  dayOf,
  durationUnitOptions,
  employeeOptions,
  openPeriods,
  periodOn,
  periodOptions,
  periodsForNewTimesheet,
  projectOptions,
  statusIds,
  ymd,
  type StatusIds,
} from './timesheet.lookups';
import { canEdit, loadTimesheet, roleOf, timesheetPolicy, type TimesheetRole, type TimesheetRow } from './timesheet.service';

/**
 * Timesheet form — CI timesheet/timesheet::initForm($id). Labels, required flags and visibility of
 * the timesheet columns come from the entity metadata (timesheet / timesheet_vw, CI getColDetails
 * with its aliases and explicit $required); the rest is CI's controller logic:
 *  - Employee: administrators choose (fixed on edit); a user always files his own;
 *  - Period (open timesheet periods; with delayed deduction a user only gets the allowed ones) fills
 *    the start / end date; Timesheet Date is today (add only);
 *  - Project / Activity on edit and Activity Duration / Unit when the brand's "Activity tab" is on;
 *  - buttons and the items table depend on who the caller is to the timesheet and its status.
 */

interface Scope {
  st: StatusIds;
  brandId: number | null;
  activityTab: boolean;
  role: TimesheetRole | null;
  editable: boolean;
  statusName: string;
}

const PERIOD_FILL = { url: `${API}/period/{PERIOD_ID}`, map: { TS_START_DATE: 'startDate', TS_END_DATE: 'endDate' } };

async function itemRows(tsId: number): Promise<Array<Record<string, unknown>>> {
  return prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT ti."TS_ITEM_ID", ti."TS_DATE", ti."DURATION",
           (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = ti."DURATION_UNIT_ID" LIMIT 1) AS "DURATION_UNIT",
           (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = ti."TS_PRJ_ID" LIMIT 1) AS "PRJ_NM",
           (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = ti."TS_ACTIVITY_ID" LIMIT 1) AS "TS_ACTIVITY_NM",
           ti."START_TIME", ti."END_TIME", ti."COMMENT",
           CONCAT((SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = ti."ITEM_STATUS" LIMIT 1),
                  CASE WHEN ti."DELAY_ENTRY" = 1 THEN ' (DELAYED)' ELSE '' END) AS "STATUS"
    FROM timesheet_item ti
    WHERE ti."TS_ID" = ${tsId} AND ti."IS_DELETED" = 0
    ORDER BY ti."TS_DATE", ti."START_TIME", ti."TS_ITEM_ID"`;
}

export const timesheetForm: FormConfig<RequestSubject, Record<string, never>, TimesheetRow, Scope> = {
  titles: { add: 'Add New My Timesheet', edit: 'Edit My Timesheet' },

  async loadRecord(id, { ctx }) {
    if (!(await timesheetPolicy.check(ctx, 'read'))) throw new ForbiddenError();
    return loadTimesheet(ctx, id);
  },

  async resolveScope({ ctx, record }) {
    const st = await statusIds();
    const brandId = record?.OA_BRAND_ID ?? ctx.oaBrandId;
    const role = record ? roleOf(ctx, record) : null;
    const status = record
      ? await prisma.independent_mst.findFirst({ where: { MSTR_ID: record.TS_STATUS_ID }, select: { MSTR_NM: true } })
      : null;
    return {
      st,
      brandId,
      activityTab: await activityTabEnabled(brandId),
      role,
      editable: !record || (!!role && canEdit(role, record, st)),
      statusName: status?.MSTR_NM.trim() ?? '',
    };
  },

  async permissions({ ctx }): Promise<FormPermissions> {
    const [create, update, del] = await Promise.all([
      timesheetPolicy.check(ctx, 'create'),
      timesheetPolicy.check(ctx, 'update'),
      timesheetPolicy.check(ctx, 'delete'),
    ]);
    return { create, update, delete: del };
  },

  // CI saveButton = false for someone else's timesheet and for a submitted / approved one.
  canSubmit: ({ scope }) => scope.editable,

  lookups: {
    async PERIOD_ID({ ctx, record, scope }) {
      if (!scope.brandId) return [];
      if (!record) return periodOptions(await periodsForNewTimesheet(ctx, scope.brandId));
      const open = await openPeriods(scope.brandId);
      // The record's own period stays selectable even once it is closed.
      if (!open.some((p) => p.PERIOD_ID === record.PERIOD_ID)) {
        const own = await prisma.period_mst.findFirst({
          where: { PERIOD_ID: record.PERIOD_ID },
          select: { PERIOD_ID: true, PERIOD_START_DATE: true, PERIOD_END_DATE: true, FISCAL_PERIOD_DESC: true },
        });
        if (own) open.push(own);
      }
      return periodOptions(open);
    },
    TOT_TS_DURATIONID: () => durationUnitOptions(),
    DURATION_UNIT_ID: () => durationUnitOptions(),
    TS_PRJ_ID: async ({ scope }) => (scope.brandId ? projectOptions(scope.brandId) : []),
    TS_ACTIVITY_ID: async ({ scope }) => (scope.brandId ? activityOptions(scope.brandId) : []),
    TS_EMP_ID: async ({ ctx, scope }) => (ctx.adminLevel >= 1 && scope.brandId ? employeeOptions(scope.brandId) : []),
  },

  entity: {
    table: 'timesheet',
    view: 'timesheet_vw',
    columns: [
      'PERIOD_ID', 'TS_START_DATE', 'TS_END_DATE', 'TS_DATE', 'TOT_TS_DURATION', 'TOT_TS_DURATIONID',
      'COMMENT', 'TS_PRJ_ID', 'TS_ACTIVITY_ID', 'ACTIVITY_DURATION', 'DURATION_UNIT_ID',
    ],
    // CI getColDetails aliases: the view renames these columns.
    aliases: { TOT_TS_DURATION: 'TOTAL_TS_DURATION', DURATION_UNIT_ID: 'TOT_ACTY_DURATIONID' },
    types: {
      TS_START_DATE: 'text', TS_END_DATE: 'text', TS_DATE: 'text',
      TOT_TS_DURATION: 'number', ACTIVITY_DURATION: 'text', COMMENT: 'textarea',
    },
    // CI's explicit $required per getColDetails call (not the columns' NOT NULL flags).
    required: {
      PERIOD_ID: true, TS_START_DATE: true, TS_END_DATE: true, TS_DATE: true,
      TOT_TS_DURATION: true, TOT_TS_DURATIONID: true, COMMENT: true,
      TS_PRJ_ID: false, TS_ACTIVITY_ID: false, ACTIVITY_DURATION: false, DURATION_UNIT_ID: false,
    },
  },
  schema: { add: timesheetCreateSchema, edit: timesheetUpdateSchema },

  fields: [
    { name: 'TS_EMP_ID', label: 'Employee', type: 'select', required: true, optionsFrom: 'TS_EMP_ID', when: (s) => s.ctx.adminLevel >= 1 },
    { name: 'STATUS_NM', label: 'Timesheet Status', type: 'text', modes: ['edit'] },
  ],
  // CI control order: Employee, Period, Start, End, Status, Timesheet Date, durations, comment, project, activity.
  fieldProps: {
    TS_EMP_ID: { order: -1 },
    PERIOD_ID: { fillFrom: PERIOD_FILL },
    STATUS_NM: { order: 2.5 },
  },

  hiddenFields: (s) => [
    ...(s.mode === 'edit' ? ['TS_DATE'] : ['TS_PRJ_ID', 'TS_ACTIVITY_ID']),
    ...(s.scope.activityTab ? [] : ['TS_PRJ_ID', 'TS_ACTIVITY_ID', 'ACTIVITY_DURATION', 'DURATION_UNIT_ID']),
    // OrgDetailsView (system admin): the brand comes from the employee.
    'oaId', 'oaBrandId',
  ],
  readonlyFields: (s) => [
    'TS_START_DATE', 'TS_END_DATE', 'TS_DATE', 'STATUS_NM', 'ACTIVITY_DURATION', 'DURATION_UNIT_ID',
    ...(s.mode === 'edit' ? ['PERIOD_ID', 'TS_EMP_ID'] : []),
  ],

  async defaults({ ctx, scope, lookups }) {
    const hours = await getMasterId(UNIT_HOURS);
    const today = ymd(new Date());
    const current = scope.brandId ? await periodOn(today, scope.brandId) : null;
    const offered = (lookups.PERIOD_ID as Array<{ value: number }> | undefined) ?? [];
    const period = current && offered.some((o) => o.value === current.PERIOD_ID) ? current : null;
    return {
      TS_DATE: today,
      TOT_TS_DURATIONID: hours ?? '',
      DURATION_UNIT_ID: hours ?? '',
      ACTIVITY_DURATION: '0',
      PERIOD_ID: period?.PERIOD_ID ?? '',
      TS_START_DATE: dayOf(period?.PERIOD_START_DATE),
      TS_END_DATE: dayOf(period?.PERIOD_END_DATE),
      TS_PRJ_ID: (await currentProject(ctx.userId)) ?? '',
    };
  },

  toValues: (r, s) => ({
    TS_EMP_ID: r.TS_EMP_ID,
    PERIOD_ID: r.PERIOD_ID,
    TS_START_DATE: dayOf(r.TS_START_DATE),
    TS_END_DATE: dayOf(r.TS_END_DATE),
    STATUS_NM: s.scope.statusName,
    TS_DATE: dayOf(r.TS_DATE),
    TOT_TS_DURATION: r.TOT_TS_DURATION ?? '',
    TOT_TS_DURATIONID: r.TOT_TS_DURATIONID ?? '',
    COMMENT: r.COMMENT ?? '',
    TS_PRJ_ID: r.TS_PRJ_ID || '',
    TS_ACTIVITY_ID: r.TS_ACTIVITY_ID || '',
    ACTIVITY_DURATION: String(r.ACTIVITY_DURATION ?? '0'),
    DURATION_UNIT_ID: r.DURATION_UNIT_ID ?? '',
  }),

  actions: {
    submit: (s) => (s.id ? { url: `${API}/${s.id}`, method: 'PUT' } : { url: API, method: 'POST' }),
  },

  /** CI $data['buttons'] of the edit form. */
  buttons({ id, record, scope }) {
    if (!id || !record || !scope.role) return [];
    const { st, role, editable } = scope;
    const status = record.TS_STATUS_ID;
    const out: FormButton[] = [];
    if (role.isOwner && !role.isAdmin && (status === st.draft || status === st.rejected)) {
      out.push({ key: 'submit', label: 'Request Approval', icon: 'send', variant: 'primary', url: `${API}/${id}/submit`, then: 'list' });
    } else if ((role.isApprover || role.isAdmin) && (status === st.pending || status === st.draft)) {
      const prompt = { name: 'approverComment', label: 'Approver Comments', value: record.APPR_CMNT ?? '' };
      out.push({ key: 'approve', label: 'Approve Timesheet', icon: 'approve', variant: 'success', url: `${API}/${id}/approve`, prompt, then: 'list' });
      out.push({ key: 'reject', label: 'Reject Timesheet', icon: 'reject', variant: 'danger', url: `${API}/${id}/reject`, prompt, then: 'list' });
    }
    if (role.isAdmin && !record.APPROVED_FOR_COPY) {
      out.push({ key: 'approve-copy', label: 'Approve for Copy', icon: 'check', url: `${API}/${id}/approve-copy`, then: 'list' });
    }
    if (!role.isAdmin && role.isOwner && record.APPROVED_FOR_COPY) {
      out.push({ key: 'copy', label: 'Copy Timesheet', icon: 'copy', url: `${API}/${id}/copy`, confirm: 'Copy this timesheet to the next period?' });
    }
    if (editable) {
      out.push({ key: 'copy-daily', label: 'Copy Daily Timesheet', icon: 'clone', url: `${API}/${id}/copy-daily` });
    }
    return out;
  },

  /** CI tableHeader / tableBody: the timesheet's items, when the brand's "Activity tab" is on. */
  async tables({ id, record, scope }) {
    if (!id || !record || !scope.activityTab || !scope.role) return [];
    const { role, st } = scope;
    const status = record.TS_STATUS_ID;
    const mayChange = role.isAdmin || (role.isOwner && (status === st.draft || status === st.rejected));
    const table: FormTable = {
      key: 'items',
      title: 'Timesheet Items',
      rowKey: 'TS_ITEM_ID',
      columns: [
        { name: 'TS_DATE', label: 'Date' },
        { name: 'DURATION', label: 'Duration' },
        { name: 'DURATION_UNIT', label: 'Duration Unit' },
        { name: 'PRJ_NM', label: 'Project Name' },
        { name: 'TS_ACTIVITY_NM', label: 'Project Activity' },
        { name: 'START_TIME', label: 'Start Time' },
        { name: 'END_TIME', label: 'End Time' },
        { name: 'COMMENT', label: 'Comment' },
        { name: 'STATUS', label: 'Status' },
      ],
      rows: await itemRows(id),
      addHref: mayChange ? `${ITEM_PAGE}/add?tsId=${id}` : null,
      addLabel: 'Add Items',
      editHref: mayChange ? `${ITEM_PAGE}/edit` : null,
      deleteApi: mayChange ? ITEM_API : null,
      emptyText: 'No timesheet items yet.',
    };
    return [table];
  },
};

import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';

import type { FormConfig, FormPermissions } from '@/lib/form-init/initForm';
import type { FormButton } from '@/lib/form-init/formExtras';
import { hrefForCi } from '@/lib/navigation/routeRegistry';
import { timesheetItemSchema } from '@/validations/timesheet.schema';
import { ITEM_API, PROJECTS_PAGE } from './timesheet.constants';
import {
  activityOptions,
  currentActivity,
  currentProject,
  dayOf,
  durationUnitOptions,
  periodOn,
  projectOptions,
  statusIds,
  ymd,
} from './timesheet.lookups';
import { canEdit, loadTimesheet, roleOf, type TimesheetRow } from './timesheet.service';
import { addMinutes, durationOf, fromTime, itemPolicy, timesheetItemService } from './timesheetItem.service';

/**
 * Timesheet item form — CI timesheetItem::initForm (from a timesheet: newTmshtItem/{tsId}, or
 * editTmshtItem/{id}) and new_timesheet_item::initForm (by date: the period is shown and the
 * timesheet is found or created on save). Labels come from the timesheet_item / timesheet_item_vw
 * entity metadata. A new item continues where the timesheet's last item ended (CI: last item's
 * date, end time → start, +30 minutes, its project / activity; else the current project / activity).
 */

export interface ItemParams {
  tsId?: number;
  /** New Timesheet Item: the day to add for (CI new_timesheet_item/index/{date}). */
  date?: string;
  byDate?: boolean;
}

interface ItemRecord {
  TS_ITEM_ID: number;
  TS_ID: number;
  TS_DATE: Date | null;
  START_TIME: Date | null;
  END_TIME: Date | null;
  DURATION: number | null;
  DURATION_UNIT_ID: number | null;
  COMMENT: string | null;
  TS_PRJ_ID: number;
  TS_ACTIVITY_ID: number | null;
}

interface Scope {
  mode: 'timesheet' | 'date' | 'choose';
  ts: TimesheetRow | null;
  editable: boolean;
  brandId: number | null;
  /** Add mode: where the new item starts (CI defaults). */
  next: { date: string; start: string; end: string; project: number | null; activity: number | null };
}

const DURATION_FILL = { url: `${ITEM_API}/duration?start={START_TIME}&end={END_TIME}`, map: { DURATION: 'duration', DURATION_UNIT_ID: 'unitId' } };

export function parseItemParams(query: Record<string, string>): ItemParams {
  const tsId = Number(query.tsId);
  return {
    ...(Number.isInteger(tsId) && tsId > 0 ? { tsId } : {}),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(query.date ?? '') ? { date: query.date } : {}),
    ...(query.byDate === '1' ? { byDate: true } : {}),
  };
}

/** CI getLastTmsht*: the timesheet's last item (by id). */
async function lastItem(tsId: number) {
  return prisma.timesheet_item.findFirst({
    where: { TS_ID: tsId, IS_DELETED: 0 },
    orderBy: { TS_ITEM_ID: 'desc' },
    select: { TS_DATE: true, END_TIME: true, TS_PRJ_ID: true, TS_ACTIVITY_ID: true },
  });
}

/** The caller's timesheets an item can be added to (CI "Timesheet" dropdown). */
async function editableTimesheets(subject: RequestSubject): Promise<Array<{ value: number; label: string }>> {
  const st = await statusIds();
  const rows = await prisma.$queryRaw<Array<{ TS_ID: number; label: string | null }>>`
    SELECT t."TS_ID", CONCAT_WS(' – ', (SELECT p."FISCAL_PERIOD_DESC" FROM period_mst p WHERE p."PERIOD_ID" = t."PERIOD_ID" LIMIT 1),
           CASE WHEN ${subject.adminLevel} > 0 THEN (SELECT te."EMP_NM" FROM timesheet_employee te WHERE te."TS_EMP_ID" = t."TS_EMP_ID" LIMIT 1) END) AS label
    FROM timesheet t
    WHERE t."IS_DELETED" = 0
      AND (${subject.adminLevel} = 2 OR (${subject.adminLevel} = 1 AND t."OA_BRAND_ID" = ${subject.oaBrandId ?? -1})
           OR (t."USER_ID" = ${subject.userId} AND t."TS_STATUS_ID" IN (${st.draft}, ${st.rejected})))
    ORDER BY t."TS_START_DATE" DESC, t."TS_ID" DESC
    LIMIT 200`;
  return rows.map((r) => ({ value: r.TS_ID, label: r.label || `#${r.TS_ID}` }));
}

export const timesheetItemForm: FormConfig<RequestSubject, ItemParams, ItemRecord, Scope> = {
  titles: { add: 'New Timesheet Item', edit: 'Edit Timesheet Item' },

  async loadRecord(id, { ctx }) {
    const { item } = await timesheetItemService.loadItem(ctx, id);
    return item as ItemRecord;
  },

  async resolveScope({ ctx, params, record }) {
    const st = await statusIds();
    const tsId = record?.TS_ID ?? params.tsId ?? null;
    // An out-of-scope timesheet is "not found" (same scope as the timesheet list).
    const ts: TimesheetRow | null = tsId ? await loadTimesheet(ctx, tsId) : null;
    const mode: Scope['mode'] = ts ? 'timesheet' : params.byDate || params.date ? 'date' : 'choose';
    const editable = ts ? canEdit(roleOf(ctx, ts), ts, st) : true;

    const today = ymd(new Date());
    const last = ts && !record ? await lastItem(ts.TS_ID) : null;
    const userId = ts?.USER_ID ?? ctx.userId;
    const project = last?.TS_PRJ_ID || (await currentProject(userId));
    const activity = last?.TS_ACTIVITY_ID ?? (await currentActivity(userId, project));
    const start = fromTime(last?.END_TIME) || '10:00';
    const date = params.date ?? (last?.TS_DATE ? dayOf(last.TS_DATE) : ts ? (today >= dayOf(ts.TS_START_DATE) && today <= dayOf(ts.TS_END_DATE) ? today : dayOf(ts.TS_START_DATE)) : today);
    return {
      mode,
      ts,
      editable,
      brandId: ts?.OA_BRAND_ID ?? ctx.oaBrandId,
      next: { date, start, end: addMinutes(start, 30), project: project ?? null, activity: activity ?? null },
    };
  },

  async permissions({ ctx }): Promise<FormPermissions> {
    const [create, update, del] = await Promise.all([itemPolicy.check(ctx, 'create'), itemPolicy.check(ctx, 'update'), itemPolicy.check(ctx, 'delete')]);
    return { create, update, delete: del };
  },
  canSubmit: ({ scope }) => scope.editable,

  lookups: {
    async TS_ID({ ctx, scope }) {
      if (scope.ts) {
        const period = await prisma.period_mst.findFirst({ where: { PERIOD_ID: scope.ts.PERIOD_ID }, select: { FISCAL_PERIOD_DESC: true } });
        return [{ value: scope.ts.TS_ID, label: period?.FISCAL_PERIOD_DESC ?? `#${scope.ts.TS_ID}` }];
      }
      return scope.mode === 'choose' ? editableTimesheets(ctx) : [];
    },
    TS_PRJ_ID: async ({ scope }) => (scope.brandId ? projectOptions(scope.brandId) : []),
    TS_ACTIVITY_ID: async ({ scope }) => (scope.brandId ? activityOptions(scope.brandId) : []),
    DURATION_UNIT_ID: () => durationUnitOptions(),
  },

  entity: {
    table: 'timesheet_item',
    view: 'timesheet_item_vw',
    columns: ['TS_ID', 'TS_PRJ_ID', 'TS_ACTIVITY_ID', 'TS_DATE', 'START_TIME', 'END_TIME', 'DURATION', 'DURATION_UNIT_ID', 'COMMENT'],
    types: { TS_DATE: 'date-input', START_TIME: 'time', END_TIME: 'time', DURATION: 'text', COMMENT: 'textarea' },
    // CI form_validation: tsid, tsdate, tsstarttime, tsendtime required; project / activity optional.
    required: {
      TS_ID: true, TS_DATE: true, START_TIME: true, END_TIME: true, DURATION: true, DURATION_UNIT_ID: true,
      TS_PRJ_ID: false, TS_ACTIVITY_ID: false, COMMENT: false,
    },
  },
  schema: { add: timesheetItemSchema, edit: timesheetItemSchema },

  fields: [
    // CI new_timesheet_item: the read-only "Timesheet Period" of the chosen day.
    { name: 'TS_PERIOD', label: 'Timesheet Period', type: 'text', modes: ['add'], when: (s) => s.scope.mode === 'date' },
  ],
  fieldProps: {
    TS_PERIOD: { order: -1 },
    TS_DATE: { fillFrom: { url: `${ITEM_API}/period?date={TS_DATE}`, map: { TS_PERIOD: 'label' } } },
    START_TIME: { fillFrom: DURATION_FILL },
    END_TIME: { fillFrom: DURATION_FILL },
  },
  hiddenFields: (s) => (s.scope.mode === 'date' ? ['TS_ID'] : []),
  readonlyFields: (s) => [
    'DURATION', 'DURATION_UNIT_ID', 'TS_PERIOD',
    ...(s.scope.ts ? ['TS_ID'] : []),
    ...(s.mode === 'edit' ? ['START_TIME'] : []),
  ],

  async defaults({ scope }) {
    const { date, start, end, project, activity } = scope.next;
    const [{ duration, unitId }, period] = await Promise.all([
      durationOf(start, end),
      scope.mode === 'date' && scope.brandId ? periodOn(date, scope.brandId) : Promise.resolve(null),
    ]);
    return {
      TS_ID: scope.ts?.TS_ID ?? '',
      TS_DATE: date,
      START_TIME: start,
      END_TIME: end,
      DURATION: String(duration),
      DURATION_UNIT_ID: unitId ?? '',
      TS_PRJ_ID: project ?? '',
      TS_ACTIVITY_ID: activity ?? '',
      COMMENT: '',
      TS_PERIOD: period?.FISCAL_PERIOD_DESC ?? '',
    };
  },
  toValues: (r) => ({
    TS_ID: r.TS_ID,
    TS_DATE: dayOf(r.TS_DATE),
    START_TIME: fromTime(r.START_TIME),
    END_TIME: fromTime(r.END_TIME),
    DURATION: r.DURATION == null ? '' : String(r.DURATION),
    DURATION_UNIT_ID: r.DURATION_UNIT_ID ?? '',
    TS_PRJ_ID: r.TS_PRJ_ID || '',
    TS_ACTIVITY_ID: r.TS_ACTIVITY_ID ?? '',
    COMMENT: r.COMMENT ?? '',
  }),

  actions: {
    submit: (s) => (s.id ? { url: `${ITEM_API}/${s.id}`, method: 'PUT' } : { url: ITEM_API, method: 'POST' }),
  },

  /** CI new_timesheet_item buttons: View Dashboard, Configure Projects, Configure Tasks (when migrated). */
  buttons({ scope }) {
    if (scope.mode !== 'date') return [];
    const links: FormButton[] = [
      { key: 'dashboard', label: 'View Dashboard', icon: 'view', href: hrefForCi('dashboard/dashboard_timesheet') ?? '' },
      { key: 'projects', label: 'Configure Projects', icon: 'projects', href: PROJECTS_PAGE },
      { key: 'tasks', label: 'Configure Tasks', icon: 'tasks', href: hrefForCi('timesheet/user_activity') ?? '' },
    ];
    return links.filter((b) => b.href);
  },
};

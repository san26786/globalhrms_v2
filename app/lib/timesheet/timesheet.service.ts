import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { menuPolicy } from '@/lib/resource/policies';
import { settingService, toNumber } from '@/lib/settings/settingService';
import { resolveBrand } from '@/lib/utilities/access';
import { generatePeriods } from '@/lib/utilities/periodGenerator';
import {
  autoGenerateSchema,
  bulkStatusSchema,
  decisionSchema,
  delayedPermissionSchema,
  timesheetCreateSchema,
  timesheetUpdateSchema,
} from '@/validations/timesheet.schema';
import {
  DEFAULT_COMMITTED_HOURS,
  ITEM_DRAFT,
  ITEM_SUBMITTED,
  LEAVE_ACCEPTED,
  MAX_ACTIVITY_DURATION,
  PERIOD_TYPE,
  SETTING,
  TIMESHEET_MENU,
  UNIT_HOURS,
  UNIT_MINUTES,
} from './timesheet.constants';
import {
  approverOf,
  asDate,
  currentActivity,
  currentProject,
  dayOf,
  delayedDeductionEnabled,
  employeeById,
  employeeOfUser,
  isTimesheetManager,
  periodById,
  periodOn,
  periodsForNewTimesheet,
  statusIds,
  ymd,
  type StatusIds,
  type TsEmployee,
} from './timesheet.lookups';

/**
 * Timesheet — CI controllers/timesheet/timesheet.php + models/timesheet/timesheet_m.php.
 *
 * Who may do what (CI rules, enforced here instead of only hiding buttons):
 *  - see a timesheet: system admin any; brand admin his brand's; a user his own or the ones he approves;
 *  - save: an administrator, or the owner while it is Draft or Rejected (a Rejected one returns to Draft);
 *  - Request Approval: the owner, Draft / Rejected, with items and none of them in Draft;
 *  - Approve / Reject (with a comment): the approver or an administrator, while Pending (or Draft);
 *  - Approve for Copy: administrators; Copy Timesheet: the owner once approved for copy;
 *  - delete: system admin (with items and log); brand admin only when it has no items; users never.
 *
 * Behaviour changes from CI (each fixes a defect):
 *  1. the actions check the caller's rights and the status (CI's URLs worked for anyone who knew them);
 *  2. Start / End date come from the chosen period, not from the posted read-only inputs;
 *  3. editing keeps the timesheet date and the activity duration unit (CI blanked them: their inputs were not posted);
 *  4. Copy Timesheet moves items by the distance between the periods (CI used the period length, one day short)
 *     and refuses when the next period does not exist or already has a timesheet;
 *  5. Copy Daily Timesheet looks for existing items of this employee only and recalculates the total;
 *     its "next working day" skips approved leave (CI's leave constant was undefined, so it never did);
 *  6. Auto Generate skips days that already have items (CI added duplicates on every run);
 *  7. the activity total excludes the brand's "exclude from payroll" activities (CI's filter never matched).
 */

export const timesheetPolicy = menuPolicy(TIMESHEET_MENU);

type Tx = Prisma.TransactionClient;

export interface TimesheetRow {
  TS_ID: number;
  TS_STATUS_ID: number;
  TS_START_DATE: Date;
  TS_END_DATE: Date;
  TS_EMP_ID: number;
  PERIOD_ID: number;
  APPROVER_ID: number | null;
  TOT_TS_DURATION: number | null;
  TOT_TS_DURATIONID: number | null;
  ACTIVITY_DURATION: Prisma.Decimal;
  DURATION_UNIT_ID: number | null;
  TS_DATE: Date | null;
  TS_PRJ_ID: number;
  TS_ACTIVITY_ID: number;
  COMMENT: string | null;
  APPR_CMNT: string;
  APPROVED_FOR_COPY: number;
  OA_ID: number | null;
  OA_BRAND_ID: number;
  USER_ID: number | null;
}

/** What the caller is to one timesheet. */
export interface TimesheetRole {
  isAdmin: boolean;
  isOwner: boolean;
  isApprover: boolean;
}

export interface ActionResult {
  message: string;
  /** Page to open next (e.g. the copied timesheet). */
  redirect?: string;
  id?: number;
}

const isAdmin = (s: RequestSubject) => s.adminLevel >= 1;

function parseId(raw: string | number): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('Timesheet not found.');
  return id;
}

async function authorize(subject: RequestSubject, action: 'list' | 'read' | 'create' | 'update' | 'delete') {
  if (!(await timesheetPolicy.check(subject, action))) throw new ForbiddenError();
}

/** CI getTableDtl scope applied to one record: out-of-scope behaves as "not found". */
function inScope(subject: RequestSubject, row: TimesheetRow): boolean {
  if (subject.adminLevel === 2) return true;
  if (subject.adminLevel === 1) return row.OA_BRAND_ID === subject.oaBrandId;
  return row.USER_ID === subject.userId || row.APPROVER_ID === subject.userId;
}

export function roleOf(subject: RequestSubject, row: TimesheetRow): TimesheetRole {
  return { isAdmin: isAdmin(subject), isOwner: row.USER_ID === subject.userId, isApprover: row.APPROVER_ID === subject.userId };
}

/** CI saveButton rules: administrators always; the owner while Draft / Rejected. */
export function canEdit(role: TimesheetRole, row: TimesheetRow, st: StatusIds): boolean {
  return role.isAdmin || (role.isOwner && (row.TS_STATUS_ID === st.draft || row.TS_STATUS_ID === st.rejected));
}

export async function loadTimesheet(subject: RequestSubject, rawId: string | number, db: Tx | typeof prisma = prisma): Promise<TimesheetRow> {
  const row = await db.timesheet.findFirst({ where: { TS_ID: parseId(rawId), IS_DELETED: 0 } });
  if (!row || !inScope(subject, row as TimesheetRow)) throw new NotFoundError('Timesheet not found.');
  return row as TimesheetRow;
}

/** CI checkIfHasItem / checkIfAnyItemIsDraft. */
async function itemStats(db: Tx | typeof prisma, tsId: number) {
  const draftId = await getMasterId(ITEM_DRAFT);
  const [count, drafts, first] = await Promise.all([
    db.timesheet_item.count({ where: { TS_ID: tsId, IS_DELETED: 0 } }),
    draftId ? db.timesheet_item.count({ where: { TS_ID: tsId, IS_DELETED: 0, ITEM_STATUS: draftId } }) : Promise.resolve(0),
    db.timesheet_item.findFirst({ where: { TS_ID: tsId }, select: { COMMENT: true }, orderBy: { TS_ITEM_ID: 'asc' } }),
  ]);
  return { count, drafts, firstComment: first?.COMMENT ?? null };
}

/** CI timesheet_action_log insert (submit / approve / reject / create). COMMENT is varchar(250). */
async function logAction(tx: Tx, row: Pick<TimesheetRow, 'TS_ID' | 'OA_ID' | 'OA_BRAND_ID' | 'USER_ID'>, actionId: number, subject: RequestSubject, comment: string | null) {
  const now = new Date();
  await tx.timesheet_action_log.create({
    data: {
      TS_ID: row.TS_ID,
      TS_ACTION_ID: actionId,
      ACTION: '',
      COMMENT: comment ? comment.slice(0, 250) : null,
      DATE_TIME: now,
      PERFROMED_BY: subject.userId,
      OA_ID: row.OA_ID,
      OA_BRAND_ID: row.OA_BRAND_ID,
      USER_ID: row.USER_ID,
      CREATED_BY: subject.userId,
      CREATEDON: now,
    },
  });
}

/**
 * CI timesheet_m::updateTotalActivityDuration: ACTIVITY_DURATION = the items' total in hours
 * (hours and minutes items), leaving out activities the brand excludes from payroll.
 */
export async function recalcActivityDuration(db: Tx | typeof prisma, tsId: number, oaBrandId: number): Promise<void> {
  const [hoursId, minutesId, excluded] = await Promise.all([
    getMasterId(UNIT_HOURS),
    getMasterId(UNIT_MINUTES),
    db.user_activity_details.findMany({
      where: { EXCLUDE_FROM_PAYROLL: 1, IS_DELETED: 0, OA_BRAND_ID: oaBrandId, ACTIVITY_ID: { not: null } },
      select: { ACTIVITY_ID: true },
      distinct: ['ACTIVITY_ID'],
    }),
  ]);
  const excludedIds = excluded.map((e) => e.ACTIVITY_ID as number);
  const items = await db.timesheet_item.findMany({
    where: {
      TS_ID: tsId,
      IS_DELETED: 0,
      ...(excludedIds.length ? { OR: [{ TS_ACTIVITY_ID: null }, { TS_ACTIVITY_ID: { notIn: excludedIds } }] } : {}),
    },
    select: { DURATION: true, DURATION_UNIT_ID: true },
  });
  let minutes = 0;
  for (const item of items) {
    const d = Number(item.DURATION ?? 0);
    if (item.DURATION_UNIT_ID === hoursId) minutes += Math.round(d * 60);
    else if (item.DURATION_UNIT_ID === minutesId) minutes += Math.trunc(d);
  }
  const hours = Math.min(MAX_ACTIVITY_DURATION, Math.round((minutes / 60) * 100) / 100);
  await db.timesheet.update({ where: { TS_ID: tsId }, data: { ACTIVITY_DURATION: new Prisma.Decimal(hours.toFixed(2)) } });
}

/** CI CheckPeriodExists: one timesheet per employee and period. */
async function assertPeriodFree(db: Tx | typeof prisma, tsEmpId: number, periodId: number) {
  const clash = await db.timesheet.findFirst({ where: { TS_EMP_ID: tsEmpId, PERIOD_ID: periodId, IS_DELETED: 0 }, select: { TS_ID: true } });
  if (clash) throw new ValidationError('This Period already exists', { PERIOD_ID: ['This Period already exists'] });
}

const NOT_SYNCED = 'Employee information is not synchronised, Please contact business admin to correct this employee info';

/** The employee a new timesheet is for: chosen by administrators (in their brand), the caller himself otherwise. */
async function targetEmployee(subject: RequestSubject, tsEmpId: number | undefined): Promise<TsEmployee> {
  if (!isAdmin(subject)) {
    const own = await employeeOfUser(subject.userId);
    if (!own) throw new BusinessRuleError(NOT_SYNCED);
    return own;
  }
  if (!tsEmpId) throw new ValidationError('Employee is required.', { TS_EMP_ID: ['Employee is required.'] });
  const employee = await employeeById(tsEmpId);
  if (!employee || (subject.adminLevel === 1 && employee.OA_BRAND_ID !== subject.oaBrandId)) {
    throw new ValidationError('Employee not found.', { TS_EMP_ID: ['Employee not found.'] });
  }
  if (!employee.REF_EMP_ID) throw new BusinessRuleError(NOT_SYNCED);
  return employee;
}

/** CI setFormControls: someone else's timesheet created / saved by a timesheet manager goes straight to Pending. */
async function statusFor(subject: RequestSubject, ownerUserId: number | null, current: number, st: StatusIds): Promise<number> {
  if (ownerUserId !== subject.userId && (await isTimesheetManager(subject.userId))) return st.pending;
  return current;
}

export const timesheetService = {
  /** CI insert(): validation, approver from the employee's manager, Draft, action log. */
  async create(subject: RequestSubject, body: unknown): Promise<ActionResult> {
    await authorize(subject, 'create');
    const input = timesheetCreateSchema.parse(body);
    const st = await statusIds();
    const employee = await targetEmployee(subject, input.TS_EMP_ID);
    const brandId = employee.OA_BRAND_ID;

    const period = await periodById(input.PERIOD_ID, brandId);
    const allowed = await periodsForNewTimesheet(subject, brandId);
    if (!period || !allowed.some((p) => p.PERIOD_ID === period.PERIOD_ID)) {
      throw new ValidationError('Please select a valid period.', { PERIOD_ID: ['Please select a valid period.'] });
    }
    if (!period.PERIOD_START_DATE || !period.PERIOD_END_DATE) {
      throw new BusinessRuleError('The selected period has no start / end date.');
    }

    const ownerUserId = employee.REF_EMP_ID as number;
    const [approverId, status, project, oaId] = await Promise.all([
      approverOf(employee),
      statusFor(subject, ownerUserId, st.draft, st),
      input.TS_PRJ_ID ? Promise.resolve(input.TS_PRJ_ID) : currentProject(ownerUserId),
      employee.OA_ID ? Promise.resolve(employee.OA_ID) : prisma.oa_brands.findFirst({ where: { OA_BRAND_ID: brandId }, select: { OA_ID: true } }).then((b) => b?.OA_ID ?? null),
    ]);

    await assertInsertSafe('timesheet', 'TS_ID');
    await assertInsertSafe('timesheet_action_log', 'TS_ACTION_LOG_ID');
    const now = new Date();
    const id = await prisma.$transaction(async (tx) => {
      await assertPeriodFree(tx, employee.TS_EMP_ID, period.PERIOD_ID);
      const row = await tx.timesheet.create({
        data: {
          TS_STATUS_ID: status,
          TS_START_DATE: period.PERIOD_START_DATE as Date,
          TS_END_DATE: period.PERIOD_END_DATE as Date,
          TS_EMP_ID: employee.TS_EMP_ID,
          PERIOD_ID: period.PERIOD_ID,
          APPROVER_ID: approverId,
          TOT_TS_DURATION: input.TOT_TS_DURATION,
          TOT_TS_DURATIONID: input.TOT_TS_DURATIONID,
          TS_DATE: asDate(input.TS_DATE ?? ymd(now)),
          TS_PRJ_ID: project ?? 0,
          TS_ACTIVITY_ID: input.TS_ACTIVITY_ID ?? 0,
          COMMENT: input.COMMENT,
          APPR_CMNT: '',
          OA_ID: oaId,
          OA_BRAND_ID: brandId,
          USER_ID: ownerUserId,
          CREATED_BY: subject.userId,
          CREATEDON: now,
        },
        select: { TS_ID: true, OA_ID: true, OA_BRAND_ID: true, USER_ID: true },
      });
      // CI logged the new timesheet with the "Approval Pending" action (hidden TsActionId).
      await logAction(tx, row, st.pending, subject, null);
      return row.TS_ID;
    });
    return { id, message: 'Successfully Added Timesheet' };
  },

  /** CI update(): only while editable; a Rejected timesheet saved by its owner is Draft again. */
  async update(subject: RequestSubject, rawId: string, body: unknown): Promise<ActionResult> {
    await authorize(subject, 'update');
    const input = timesheetUpdateSchema.parse(body);
    const st = await statusIds();
    const row = await loadTimesheet(subject, rawId);
    const role = roleOf(subject, row);
    if (!canEdit(role, row, st)) throw new ForbiddenError('This timesheet can no longer be edited.');

    const employee = await employeeById(row.TS_EMP_ID);
    if (!employee) throw new BusinessRuleError(NOT_SYNCED);
    let status = !role.isAdmin && row.TS_STATUS_ID === st.rejected ? st.draft : row.TS_STATUS_ID;
    status = await statusFor(subject, row.USER_ID, status, st);

    await prisma.timesheet.update({
      where: { TS_ID: row.TS_ID },
      data: {
        TS_STATUS_ID: status,
        APPROVER_ID: await approverOf(employee),
        TOT_TS_DURATION: input.TOT_TS_DURATION,
        TOT_TS_DURATIONID: input.TOT_TS_DURATIONID,
        COMMENT: input.COMMENT,
        ...(input.TS_PRJ_ID !== undefined ? { TS_PRJ_ID: input.TS_PRJ_ID } : {}),
        ...(input.TS_ACTIVITY_ID !== undefined ? { TS_ACTIVITY_ID: input.TS_ACTIVITY_ID } : {}),
        UPDATED_BY: subject.userId,
        UPDATEDON: new Date(),
      },
    });
    return { id: row.TS_ID, message: 'Successfully Updated Employee Timesheet Details' };
  },

  /** CI delete(): system admin with items and log; brand admin only without items; users never. */
  async remove(subject: RequestSubject, rawId: string): Promise<ActionResult> {
    await authorize(subject, 'delete');
    const row = await loadTimesheet(subject, rawId);
    if (!isAdmin(subject)) {
      throw new ForbiddenError('Access Denied! You can not delete this timesheet, Please contact to administrator!');
    }
    const { count } = await itemStats(prisma, row.TS_ID);
    if (subject.adminLevel === 1 && count > 0) {
      throw new BusinessRuleError('Please first delete timesheet Item to delete this timesheet');
    }
    await prisma.$transaction([
      prisma.timesheet.update({ where: { TS_ID: row.TS_ID }, data: { IS_DELETED: 1, UPDATED_BY: subject.userId, UPDATEDON: new Date() } }),
      prisma.timesheet_item.updateMany({ where: { TS_ID: row.TS_ID }, data: { IS_DELETED: 1 } }),
      prisma.timesheet_action_log.updateMany({ where: { TS_ID: row.TS_ID }, data: { IS_DELETED: 1 } }),
    ]);
    return { id: row.TS_ID, message: 'Successfully Deleted Timesheet' };
  },

  /** CI submitForApprovalTs(): the owner sends a Draft / Rejected timesheet with complete items. */
  async submit(subject: RequestSubject, rawId: string): Promise<ActionResult> {
    await authorize(subject, 'update');
    const st = await statusIds();
    const row = await loadTimesheet(subject, rawId);
    const role = roleOf(subject, row);
    if (!role.isOwner && !role.isAdmin) throw new ForbiddenError('Only the employee can request approval of this timesheet.');
    if (row.TS_STATUS_ID !== st.draft && row.TS_STATUS_ID !== st.rejected) {
      throw new BusinessRuleError('This timesheet has already been submitted.');
    }
    const items = await itemStats(prisma, row.TS_ID);
    if (!items.count) throw new BusinessRuleError('Please add timesheet item before submitting');
    if (items.drafts) throw new BusinessRuleError('Some Timesheet items are in draft');

    await prisma.$transaction(async (tx) => {
      await tx.timesheet.update({ where: { TS_ID: row.TS_ID }, data: { TS_STATUS_ID: st.pending, UPDATED_BY: subject.userId, UPDATEDON: new Date() } });
      await logAction(tx, row, st.pending, subject, items.firstComment);
    });
    return { id: row.TS_ID, message: 'Timesheet submitted for Approval' };
  },

  /** CI ApproveTs / RejectTs: the approver (or an administrator) decides, with a comment. */
  async decide(subject: RequestSubject, rawId: string, decision: 'approve' | 'reject', body: unknown): Promise<ActionResult> {
    await authorize(subject, 'update');
    const { approverComment } = decisionSchema.parse(body ?? {});
    const st = await statusIds();
    const row = await loadTimesheet(subject, rawId);
    const role = roleOf(subject, row);
    if (!role.isApprover && !role.isAdmin) throw new ForbiddenError('Only the approver can approve or reject this timesheet.');
    if (row.TS_STATUS_ID !== st.pending && row.TS_STATUS_ID !== st.draft) {
      throw new BusinessRuleError('Only timesheets awaiting approval can be approved or rejected.');
    }
    const status = decision === 'approve' ? st.approved : st.rejected;
    const items = await itemStats(prisma, row.TS_ID);
    await prisma.$transaction(async (tx) => {
      await tx.timesheet.update({
        where: { TS_ID: row.TS_ID },
        data: { TS_STATUS_ID: status, APPR_CMNT: approverComment, UPDATED_BY: subject.userId, UPDATEDON: new Date() },
      });
      await logAction(tx, row, status, subject, items.firstComment);
    });
    return { id: row.TS_ID, message: decision === 'approve' ? 'Timesheet Accepted' : 'Timesheet Rejected' };
  },

  /** CI change_ts_status/{APR|RJT}: administrators approve / reject the selected timesheets. */
  async bulkStatus(subject: RequestSubject, body: unknown): Promise<ActionResult> {
    await authorize(subject, 'update');
    if (!isAdmin(subject)) throw new ForbiddenError();
    const { status, ids } = bulkStatusSchema.parse(body);
    if (!ids.length) throw new BusinessRuleError('Please Select the TimeSheet');
    const st = await statusIds();
    const rows = await prisma.timesheet.findMany({ where: { TS_ID: { in: ids }, IS_DELETED: 0 } });
    const allowed = rows.filter((r) => inScope(subject, r as TimesheetRow)).map((r) => r.TS_ID);
    if (!allowed.length) {
      throw new BusinessRuleError(status === 'approve' ? 'Could not approve selected timesheets' : 'Could not reject selected timesheets');
    }
    await prisma.timesheet.updateMany({
      where: { TS_ID: { in: allowed } },
      data: { TS_STATUS_ID: status === 'approve' ? st.approved : st.rejected, UPDATED_BY: subject.userId, UPDATEDON: new Date() },
    });
    return { message: 'Successfully Updated Employee Timesheet Details' };
  },

  /** CI ApproveForCopy: an administrator lets the employee copy this timesheet to the next period. */
  async approveForCopy(subject: RequestSubject, rawId: string): Promise<ActionResult> {
    await authorize(subject, 'update');
    if (!isAdmin(subject)) throw new ForbiddenError();
    const row = await loadTimesheet(subject, rawId);
    await prisma.timesheet.update({ where: { TS_ID: row.TS_ID }, data: { APPROVED_FOR_COPY: 1, UPDATED_BY: subject.userId, UPDATEDON: new Date() } });
    return { id: row.TS_ID, message: 'Timesheet approved for copy' };
  },

  /**
   * CI copyTimesheet: a Draft copy in the period after this one, items moved to the same weekday of
   * the new period (as Draft items); the "approved for copy" mark is used up.
   */
  async copy(subject: RequestSubject, rawId: string): Promise<ActionResult> {
    await authorize(subject, 'create');
    const st = await statusIds();
    const row = await loadTimesheet(subject, rawId);
    if (!roleOf(subject, row).isOwner && !isAdmin(subject)) throw new ForbiddenError();
    if (!row.APPROVED_FOR_COPY) throw new BusinessRuleError('This timesheet has not been approved for copy.');

    const nextDay = ymd(addDays(parseISO(dayOf(row.TS_END_DATE)), 1));
    const period = await periodOn(nextDay, row.OA_BRAND_ID);
    if (!period?.PERIOD_START_DATE || !period.PERIOD_END_DATE) {
      throw new BusinessRuleError('There is no timesheet period after this one. Please generate the timesheet period first.');
    }
    const shift = differenceInCalendarDays(period.PERIOD_START_DATE, row.TS_START_DATE);
    const draftItem = await getMasterId(ITEM_DRAFT);

    await assertInsertSafe('timesheet', 'TS_ID');
    await assertInsertSafe('timesheet_item', 'TS_ITEM_ID');
    const now = new Date();
    const newId = await prisma.$transaction(async (tx) => {
      await assertPeriodFree(tx, row.TS_EMP_ID, period.PERIOD_ID);
      const copy = await tx.timesheet.create({
        data: {
          TS_STATUS_ID: st.draft,
          TS_START_DATE: period.PERIOD_START_DATE as Date,
          TS_END_DATE: period.PERIOD_END_DATE as Date,
          TS_EMP_ID: row.TS_EMP_ID,
          PERIOD_ID: period.PERIOD_ID,
          APPROVER_ID: row.APPROVER_ID,
          TOT_TS_DURATION: row.TOT_TS_DURATION,
          TOT_TS_DURATIONID: row.TOT_TS_DURATIONID,
          ACTIVITY_DURATION: row.ACTIVITY_DURATION,
          DURATION_UNIT_ID: row.DURATION_UNIT_ID,
          TS_DATE: period.PERIOD_START_DATE as Date,
          TS_PRJ_ID: row.TS_PRJ_ID,
          TS_ACTIVITY_ID: row.TS_ACTIVITY_ID,
          COMMENT: row.COMMENT,
          APPR_CMNT: '',
          APPROVED_FOR_COPY: 0,
          OA_ID: row.OA_ID,
          OA_BRAND_ID: row.OA_BRAND_ID,
          USER_ID: row.USER_ID,
          CREATED_BY: subject.userId,
          CREATEDON: now,
        },
        select: { TS_ID: true },
      });
      const items = await tx.timesheet_item.findMany({ where: { TS_ID: row.TS_ID, IS_DELETED: 0 } });
      if (items.length) {
        await tx.timesheet_item.createMany({
          data: items.map((i) => ({
            TS_ID: copy.TS_ID,
            TS_DATE: i.TS_DATE ? addDays(i.TS_DATE, shift) : null,
            START_TIME: i.START_TIME,
            END_TIME: i.END_TIME,
            DURATION: i.DURATION,
            DURATION_UNIT_ID: i.DURATION_UNIT_ID,
            COMMENT: i.COMMENT,
            TS_PRJ_ID: i.TS_PRJ_ID,
            TS_ACTIVITY_ID: i.TS_ACTIVITY_ID,
            PERIOD_ID: period.PERIOD_ID,
            ITEM_STATUS: draftItem,
            OA_ID: i.OA_ID,
            OA_BRAND_ID: i.OA_BRAND_ID,
            USER_ID: i.USER_ID,
            CREATED_BY: subject.userId,
            CREATEDON: now,
          })),
        });
      }
      await tx.timesheet.update({ where: { TS_ID: row.TS_ID }, data: { APPROVED_FOR_COPY: 0 } });
      return copy.TS_ID;
    });
    return { id: newId, message: 'Timesheet copied successfully' };
  },

  /**
   * CI copyDailyTimesheet: the items of the employee's last filled day are copied (as Draft) to the
   * next working day, when that day is in this timesheet's period and has no items yet.
   */
  async copyDaily(subject: RequestSubject, rawId: string): Promise<ActionResult> {
    await authorize(subject, 'update');
    const st = await statusIds();
    const row = await loadTimesheet(subject, rawId);
    if (!canEdit(roleOf(subject, row), row, st)) throw new ForbiddenError('This timesheet can no longer be edited.');

    const [last] = await prisma.$queryRaw<Array<{ day: Date | null }>>`
      SELECT MAX(ti."TS_DATE") AS day FROM timesheet_item ti JOIN timesheet t ON t."TS_ID" = ti."TS_ID"
      WHERE t."IS_DELETED" = 0 AND ti."IS_DELETED" = 0 AND t."TS_EMP_ID" = ${row.TS_EMP_ID}`;
    if (!last?.day) throw new BusinessRuleError('There are no timesheet items to copy.');
    const lastDay = dayOf(last.day);
    if (lastDay >= ymd(new Date())) throw new BusinessRuleError('Timesheet Items cannot be copied for future date');

    const target = await nextWorkingDay(lastDay, row);
    const period = await periodOn(target, row.OA_BRAND_ID);
    if (period?.PERIOD_ID !== row.PERIOD_ID) throw new BusinessRuleError('Please create timesheet with next period');

    const existing = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*) AS n FROM timesheet_item ti JOIN timesheet t ON t."TS_ID" = ti."TS_ID"
      WHERE t."IS_DELETED" = 0 AND ti."IS_DELETED" = 0 AND t."TS_EMP_ID" = ${row.TS_EMP_ID} AND ti."TS_DATE" = ${asDate(target)}`;
    if (Number(existing[0]?.n ?? 0) > 0) throw new BusinessRuleError('Timesheet Items of current date already exists');

    const draftItem = await getMasterId(ITEM_DRAFT);
    const source = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT ti.* FROM timesheet_item ti JOIN timesheet t ON t."TS_ID" = ti."TS_ID"
      WHERE t."IS_DELETED" = 0 AND ti."IS_DELETED" = 0 AND t."TS_EMP_ID" = ${row.TS_EMP_ID} AND ti."TS_DATE" = ${last.day}`;
    await assertInsertSafe('timesheet_item', 'TS_ITEM_ID');
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.timesheet_item.createMany({
        data: source.map((i) => ({
          TS_ID: row.TS_ID,
          TS_DATE: asDate(target),
          START_TIME: (i.START_TIME as Date | null) ?? null,
          END_TIME: (i.END_TIME as Date | null) ?? null,
          DURATION: (i.DURATION as number | null) ?? null,
          DURATION_UNIT_ID: (i.DURATION_UNIT_ID as number | null) ?? null,
          COMMENT: (i.COMMENT as string | null) ?? null,
          TS_PRJ_ID: i.TS_PRJ_ID as number,
          TS_ACTIVITY_ID: (i.TS_ACTIVITY_ID as number | null) ?? null,
          PERIOD_ID: row.PERIOD_ID,
          ITEM_STATUS: draftItem,
          OA_ID: (i.OA_ID as number | null) ?? null,
          OA_BRAND_ID: i.OA_BRAND_ID as number,
          USER_ID: (i.USER_ID as number | null) ?? null,
          CREATED_BY: subject.userId,
          CREATEDON: now,
        })),
      });
      await recalcActivityDuration(tx, row.TS_ID, row.OA_BRAND_ID);
    });
    return { id: row.TS_ID, message: 'Last Timesheet Items copied successfully' };
  },

  /**
   * CI autoGenerateTImesheet: the employee's timesheet for the period (created as Pending when
   * missing, like new_timesheet_item_m::createTimesheet) gets one item per day with punches:
   * first punch-in to last punch-out, in hours, on the current project / activity.
   */
  async autoGenerate(subject: RequestSubject, body: unknown): Promise<ActionResult> {
    await authorize(subject, 'create');
    if (!isAdmin(subject)) throw new ForbiddenError();
    const input = autoGenerateSchema.parse(body);
    const employee = await targetEmployee(subject, input.TS_EMP_ID);
    const userId = employee.REF_EMP_ID as number;
    const period = await periodById(input.PERIOD_ID, employee.OA_BRAND_ID);
    if (!period?.PERIOD_START_DATE || !period.PERIOD_END_DATE) {
      throw new ValidationError('Period Not Found.', { PERIOD_ID: ['Period Not Found.'] });
    }
    const st = await statusIds();
    const [hoursId, submittedItem, projectId] = await Promise.all([getMasterId(UNIT_HOURS), getMasterId(ITEM_SUBMITTED), currentProject(userId)]);
    const activityId = await currentActivity(userId, projectId);

    const attendance = await prisma.attendance_employee.findFirst({ where: { REF_EMP_ID: userId, IS_DELETED: 0 }, select: { ATTND_EMP_ID: true } });
    const punches = attendance
      ? await prisma.$queryRaw<Array<{ day: Date; first_in: Date | null; last_out: Date | null }>>`
          SELECT DATE("PUNCH_IN_USER_TIME") AS day, MIN("PUNCH_IN_USER_TIME") AS first_in,
                 (ARRAY_AGG("PUNCH_OUT_USER_TIME" ORDER BY "PUNCH_IN_USER_TIME" DESC))[1] AS last_out
          FROM emp_attendance_record
          WHERE "ATTND_EMP_ID" = ${attendance.ATTND_EMP_ID} AND "IS_DELETED" = 0
            AND DATE("PUNCH_IN_USER_TIME") BETWEEN ${period.PERIOD_START_DATE} AND ${period.PERIOD_END_DATE}
          GROUP BY DATE("PUNCH_IN_USER_TIME")`
      : [];

    await assertInsertSafe('timesheet', 'TS_ID');
    await assertInsertSafe('timesheet_item', 'TS_ITEM_ID');
    const now = new Date();
    const created = await prisma.$transaction(async (tx) => {
      const ts = await ensureTimesheet(tx, subject, employee, period, st);
      const filled = new Set(
        (await tx.timesheet_item.findMany({ where: { TS_ID: ts.TS_ID, IS_DELETED: 0 }, select: { TS_DATE: true } })).map((i) => dayOf(i.TS_DATE)),
      );
      const rows = punches
        .filter((p) => p.first_in && p.last_out && !filled.has(dayOf(p.day)))
        .map((p) => {
          const start = p.first_in as Date;
          const end = p.last_out as Date;
          return {
            TS_ID: ts.TS_ID,
            TS_DATE: p.day,
            START_TIME: timeOf(start),
            END_TIME: timeOf(end),
            DURATION: Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 100) / 100,
            DURATION_UNIT_ID: hoursId,
            COMMENT: 'Auto Generated By System',
            TS_PRJ_ID: projectId ?? 0,
            TS_ACTIVITY_ID: activityId,
            PERIOD_ID: period.PERIOD_ID,
            ITEM_STATUS: submittedItem,
            OA_ID: employee.OA_ID,
            OA_BRAND_ID: employee.OA_BRAND_ID,
            USER_ID: userId,
            CREATED_BY: subject.userId,
            CREATEDON: now,
          };
        })
        .filter((r) => r.DURATION > 0);
      if (rows.length) await tx.timesheet_item.createMany({ data: rows });
      await recalcActivityDuration(tx, ts.TS_ID, employee.OA_BRAND_ID);
      return rows.length;
    });
    return {
      message: created ? 'Successfully Auto Generated Timesheet' : 'No punch records without timesheet items were found for this period.',
    };
  },

  /** CI grantDelayedTimesheetPermission (delayed deduction on): allow entries for past dates. */
  async grantDelayed(subject: RequestSubject, body: unknown): Promise<ActionResult> {
    await authorize(subject, 'update');
    if (!isAdmin(subject)) throw new ForbiddenError();
    const input = delayedPermissionSchema.parse(body);
    const employee = await targetEmployee(subject, input.TS_EMP_ID);
    if (!(await delayedDeductionEnabled(employee.OA_BRAND_ID))) {
      throw new BusinessRuleError('Delayed timesheet deduction is not enabled for this brand.');
    }
    await assertInsertSafe('delayed_timesheet_permission', 'DTP_ID');
    const now = new Date();
    await prisma.delayed_timesheet_permission.create({
      data: {
        TS_EMP_ID: employee.TS_EMP_ID,
        START_DATE: asDate(input.START_DATE),
        END_DATE: asDate(input.END_DATE),
        DELAYED_FLAG: input.DELAYED_FLAG,
        OA_ID: employee.OA_ID ?? subject.oaId ?? 0,
        OA_BRAND_ID: employee.OA_BRAND_ID,
        APPROVER_ID: subject.userId,
        CREATED_BY: subject.userId,
        UPDATED_BY: subject.userId,
        CREATED_ON: now,
        UPDATED_ON: now,
      },
    });
    return { message: 'Permission given successfully.' };
  },

  /** CI generatePeriod: the brand's Timesheet Periods from its period settings. */
  async generatePeriods(subject: RequestSubject): Promise<ActionResult> {
    await authorize(subject, 'create');
    if (!isAdmin(subject)) throw new ForbiddenError();
    const brand = await resolveBrand(subject);
    const result = await generatePeriods(subject, brand, new Date(), { onlyTypeCodes: [PERIOD_TYPE] });
    const r = result.results[0];
    if (!r || r.status === 'not_generated') {
      throw new BusinessRuleError('Please update the Timesheet Period start date and frequency settings first.');
    }
    return { message: r.status === 'exists' ? 'Timesheet Period Already Exists' : 'Timesheet Period added Successfully' };
  },

  /** CI dependablePeriodId: a period's start / end date (fills the form). */
  async periodDates(subject: RequestSubject, rawId: string) {
    await authorize(subject, 'read');
    const id = Number(rawId);
    const period = Number.isInteger(id) && id > 0 ? await periodById(id, subject.adminLevel === 2 ? null : subject.oaBrandId) : null;
    if (!period) throw new NotFoundError('Period not found.');
    return { startDate: dayOf(period.PERIOD_START_DATE), endDate: dayOf(period.PERIOD_END_DATE) };
  },
};

/**
 * CI new_timesheet_item_m::checkTimesheetExists + ::createTimesheet: the employee's timesheet
 * covering the period's start; when missing it is created Pending, with the brand's working days ×
 * the job's committed hours as default duration and the current project / activity.
 */
export async function ensureTimesheet(
  tx: Tx,
  subject: RequestSubject,
  employee: TsEmployee,
  period: { PERIOD_ID: number; PERIOD_START_DATE: Date | null; PERIOD_END_DATE: Date | null },
  st: StatusIds,
): Promise<{ TS_ID: number; created: boolean }> {
  const userId = employee.REF_EMP_ID as number;
  const start = period.PERIOD_START_DATE as Date;
  const existing = await tx.timesheet.findFirst({
    where: { USER_ID: userId, IS_DELETED: 0, TS_START_DATE: { lte: start }, TS_END_DATE: { gte: start } },
    select: { TS_ID: true },
  });
  if (existing) return { TS_ID: existing.TS_ID, created: false };

  await assertInsertSafe('timesheet', 'TS_ID');
  const [hoursId, projectId, job, workingDays, approverId] = await Promise.all([
    getMasterId(UNIT_HOURS),
    currentProject(userId),
    tx.job_mst.findFirst({ where: { USER_ID: userId, IS_DELETED: 0 }, select: { COMMITED_HOURS: true }, orderBy: { JOB_ID: 'desc' } }),
    settingService.getValue(SETTING.workingDaysPerWeek, employee.OA_BRAND_ID),
    approverOf(employee),
  ]);
  const activityId = await currentActivity(userId, projectId);
  const committed = job?.COMMITED_HOURS || DEFAULT_COMMITTED_HOURS;
  const row = await tx.timesheet.create({
    data: {
      TS_STATUS_ID: st.pending,
      TS_START_DATE: start,
      TS_END_DATE: period.PERIOD_END_DATE as Date,
      TS_EMP_ID: employee.TS_EMP_ID,
      PERIOD_ID: period.PERIOD_ID,
      APPROVER_ID: approverId,
      TOT_TS_DURATION: toNumber(workingDays) * committed,
      TOT_TS_DURATIONID: hoursId,
      DURATION_UNIT_ID: hoursId,
      TS_DATE: start,
      TS_PRJ_ID: projectId ?? 0,
      TS_ACTIVITY_ID: activityId ?? 0,
      COMMENT: 'Created from New Timesheet item',
      APPR_CMNT: '',
      OA_ID: employee.OA_ID,
      OA_BRAND_ID: employee.OA_BRAND_ID,
      USER_ID: userId,
      CREATED_BY: subject.userId,
      CREATEDON: new Date(),
    },
    select: { TS_ID: true },
  });
  return { TS_ID: row.TS_ID, created: true };
}

/** A punch time as the TIME value Prisma writes (1970-01-01, local clock time of the punch). */
function timeOf(d: Date): Date {
  return new Date(`1970-01-01T${format(d, 'HH:mm:ss')}.000Z`);
}

/**
 * CI timesheet_m::getNextWorkingDay: the first day after `day` that is not a weekly off, a brand
 * holiday or a day of approved leave of the employee (at most 31 days ahead).
 */
async function nextWorkingDay(day: string, row: TimesheetRow): Promise<string> {
  const [weeklyOff, leaveAccepted] = await Promise.all([
    settingService.getValues(SETTING.weeklyOff, row.OA_BRAND_ID),
    getMasterId(LEAVE_ACCEPTED),
  ]);
  const off = new Set(weeklyOff.map((d) => d.trim().toLowerCase()));
  let candidate = parseISO(day);
  for (let i = 0; i < 31; i++) {
    candidate = addDays(candidate, 1);
    const date = asDate(ymd(candidate));
    if (off.has(format(candidate, 'EEEE').toLowerCase())) continue;
    const [holiday, leave] = await Promise.all([
      prisma.holiday_mst.count({ where: { OA_BRAND_ID: row.OA_BRAND_ID, IS_DELETED: 0, START_DATE: date } }),
      leaveAccepted && row.USER_ID
        ? prisma.leave_requests_dtl.count({
            where: { USER_ID: row.USER_ID, IS_DELETED: 0, LEAVE_STATUS: leaveAccepted, START_DATE: { lte: date }, END_DATE: { gte: date } },
          })
        : Promise.resolve(0),
    ]);
    if (!holiday && !leave) return ymd(candidate);
  }
  return ymd(candidate);
}

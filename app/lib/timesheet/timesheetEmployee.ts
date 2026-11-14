import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { syncModuleEmployees } from '@/lib/common/moduleSync.service';
import type { FormConfig, FormPermissions } from '@/lib/form-init/initForm';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '@/lib/http/errors';
import type { ListActionDefinition, ListScope } from '@/lib/listview/listDefinitions';
import { getMasterId, getMasterOptionsByType } from '@/lib/masters/masterService';
import { anyOf, menuPolicy } from '@/lib/resource/policies';
import { resolveBrand } from '@/lib/utilities/access';
import { timesheetEmployeeUpdateSchema } from '@/validations/timesheet.schema';
import { EMP_CURRENT } from './timesheet.constants';
import type { ActionResult } from './timesheet.service';

/**
 * Timesheet Employee — CI controllers/timesheet/timesheet_emp.php + models/timesheet/timesheet_emp_m.php.
 *
 *  - index($empStatus): timesheet_employee_vw of the brand (a user: his own row, CI $userColumnName
 *    REF_EMP_ID = session user), filtered on the Employment Status (default Current, "All" = none);
 *  - "Sync Module" (is_admin != 0): common/modulesync/syncit/timesheet_employee/{brand} — the brand's
 *    employees upserted from emp_mst (lib/common/moduleSync.service syncModuleEmployees);
 *  - initForm / update: employee code and name read-only, Is Manager, Manager; a new manager becomes
 *    the approver of the employee's timesheets (CI timesheet_m::updateTimesheetApp);
 *  - delete: soft delete.
 *
 * Behaviour change from CI: the Manager dropdown lists the brand's timesheet employees flagged as
 * managers (value TS_EMP_ID). CI listed emp_mst rows (value EMP_ID) while MANAGER_ID — and its own
 * approver update — expect a TS_EMP_ID, so a CI selection pointed at the wrong row.
 */

export const timesheetEmpPolicy = anyOf(menuPolicy('timesheet/timesheet_emp'), menuPolicy('timesheet/timesheet'));

export const EMP_PAGE = '/timesheet/timesheet_emp';
export const EMP_API = '/api/timesheet/timesheet_emp';
/** independent_mst type of the employment statuses (CI constant EMPLOYEMENTSTATUS). */
const EMPLOYMENT_STATUS_TYPE = 190;
const EMP_ALL = 'ESALL';

export interface TimesheetEmployeeRow {
  TS_EMP_ID: number;
  REF_EMP_ID: number | null;
  REF_EMP_CD: string | null;
  EMP_NM: string | null;
  IS_MANAGER: string | null;
  MANAGER_ID: number | null;
  OA_BRAND_ID: number;
}

const positive = (raw: string | undefined) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** CI index($empStatus): no status → Current; "All" (ESALL) → no filter. */
export async function timesheetEmpListScope(_subject: RequestSubject, query: Record<string, string>): Promise<ListScope> {
  const [current, all] = await Promise.all([getMasterId(EMP_CURRENT), getMasterId(EMP_ALL)]);
  const status = positive(query.status) ?? current;
  return { equals: status && status !== all ? [{ column: 'EMP_STATUS_ID', value: status }] : [] };
}

/** CI getCustomFields(): the Employment Status filter (administrators). */
export async function timesheetEmpFilters(subject: RequestSubject) {
  if (!(await timesheetEmpPolicy.check(subject, 'list'))) throw new ForbiddenError();
  const [statuses, current, all] = await Promise.all([
    getMasterOptionsByType(EMPLOYMENT_STATUS_TYPE),
    getMasterId(EMP_CURRENT),
    getMasterId(EMP_ALL),
  ]);
  return {
    showFilter: subject.adminLevel !== 0,
    statuses: statuses.map((s) => ({ value: String(s.value), label: s.label })),
    currentStatusId: current,
    allStatusId: all,
  };
}

/** CI index() / MyTeamTimesheetEmployee() $listActions. */
export const timesheetEmpListActions: ListActionDefinition[] = [
  {
    key: 'sync',
    title: 'Sync Module',
    icon: 'refresh',
    kind: 'api',
    minAdminLevel: 1, // CI is_admin != 0
    permission: 'update',
    request: { url: `${EMP_API}/sync`, method: 'POST' },
    ref: {
      ci: 'common/modulesync::syncit/timesheet_employee/{oaBrandID}/1 (modulesync_m::syncEmployeesNew)',
      handler: 'timesheetEmployeeService.sync',
      service: 'lib/common/moduleSync.service.syncModuleEmployees → timesheet_employee from emp_mst',
      files: ['app/api/timesheet/timesheet_emp/sync/route.ts', 'app/lib/timesheet/timesheetEmployee.ts', 'app/lib/common/moduleSync.service.ts'],
    },
  },
];

/** The row in the caller's CI scope: a brand admin / system admin the active brand, a user his own row. */
async function loadEmployee(subject: RequestSubject, rawId: string | number): Promise<TimesheetEmployeeRow> {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('Timesheet employee not found.');
  const row = await prisma.timesheet_employee.findFirst({
    where: {
      TS_EMP_ID: id,
      IS_DELETED: 0,
      ...(subject.adminLevel === 0 ? { REF_EMP_ID: subject.userId } : { OA_BRAND_ID: subject.oaBrandId ?? -1 }),
    },
    select: { TS_EMP_ID: true, REF_EMP_ID: true, REF_EMP_CD: true, EMP_NM: true, IS_MANAGER: true, MANAGER_ID: true, OA_BRAND_ID: true },
  });
  if (!row) throw new NotFoundError('Timesheet employee not found.');
  return row;
}

/** Manager choices: the brand's timesheet employees flagged as managers (and the current one), not the employee himself. */
async function managerOptions(row: TimesheetEmployeeRow) {
  const rows = await prisma.timesheet_employee.findMany({
    where: {
      OA_BRAND_ID: row.OA_BRAND_ID,
      IS_DELETED: 0,
      TS_EMP_ID: { not: row.TS_EMP_ID },
      OR: [{ IS_MANAGER: '1' }, ...(row.MANAGER_ID ? [{ TS_EMP_ID: row.MANAGER_ID }] : [])],
    },
    select: { TS_EMP_ID: true, EMP_NM: true, REF_EMP_CD: true },
    orderBy: [{ EMP_NM: 'asc' }, { TS_EMP_ID: 'asc' }],
  });
  return rows.map((r) => ({
    value: r.TS_EMP_ID,
    label: `${r.EMP_NM?.trim() || `#${r.TS_EMP_ID}`}${r.REF_EMP_CD ? ` (${r.REF_EMP_CD})` : ''}`,
  }));
}

export const timesheetEmployeeService = {
  /** CI syncit/timesheet_employee/{brand}: administrators, the active brand. */
  async sync(subject: RequestSubject): Promise<ActionResult> {
    if (subject.adminLevel < 1 || !(await timesheetEmpPolicy.check(subject, 'update'))) throw new ForbiddenError();
    const brand = await resolveBrand(subject);
    const { inserted, updated } = await syncModuleEmployees('timesheet_employee', brand.oaBrandId);
    return { message: `Sync Successfully (${inserted} added, ${updated} updated)` };
  },

  /** CI update(): Is Manager / Manager; the manager's user becomes the approver of the employee's timesheets. */
  async update(subject: RequestSubject, rawId: string, body: unknown): Promise<ActionResult> {
    if (!(await timesheetEmpPolicy.check(subject, 'update'))) throw new ForbiddenError();
    const row = await loadEmployee(subject, rawId);
    const input = timesheetEmployeeUpdateSchema.parse(body);
    const managerId = input.MANAGER_ID || null;
    let approver: number | null = null;
    if (managerId) {
      if (managerId === row.TS_EMP_ID) throw new BusinessRuleError('An employee cannot be his own manager.');
      const manager = await prisma.timesheet_employee.findFirst({
        where: { TS_EMP_ID: managerId, OA_BRAND_ID: row.OA_BRAND_ID, IS_DELETED: 0 },
        select: { REF_EMP_ID: true },
      });
      if (!manager) throw new BusinessRuleError('Please select a valid manager.');
      approver = manager.REF_EMP_ID;
    }
    await prisma.$transaction(async (tx) => {
      await tx.timesheet_employee.update({
        where: { TS_EMP_ID: row.TS_EMP_ID },
        data: { IS_MANAGER: input.IS_MANAGER ? '1' : '0', MANAGER_ID: managerId, UPDATED_BY: subject.userId, UPDATEDON: new Date() },
      });
      // CI setFormControls → timesheet_m::updateTimesheetApp(ts_empid, manager REF_EMP_ID).
      if (managerId && approver) {
        await tx.timesheet.updateMany({ where: { TS_EMP_ID: row.TS_EMP_ID }, data: { APPROVER_ID: approver } });
      }
    });
    return { message: 'Successfully Updated Timesheet Employee', id: row.TS_EMP_ID };
  },

  /** CI delete(): IS_DELETED = 1. */
  async remove(subject: RequestSubject, rawId: string): Promise<ActionResult> {
    if (!(await timesheetEmpPolicy.check(subject, 'delete'))) throw new ForbiddenError();
    const row = await loadEmployee(subject, rawId);
    await prisma.timesheet_employee.update({
      where: { TS_EMP_ID: row.TS_EMP_ID },
      data: { IS_DELETED: 1, UPDATED_BY: subject.userId, UPDATEDON: new Date() },
    });
    return { message: 'Successfully Deleted Timesheet Employee', id: row.TS_EMP_ID };
  },
};

/** CI timesheet_emp::initForm($id) (edit; CI offered no Add button on the list). */
export const timesheetEmployeeForm: FormConfig<RequestSubject, Record<string, never>, TimesheetEmployeeRow> = {
  titles: { add: 'New Timesheet Employee', edit: 'Edit Timesheet Employee' },

  async loadRecord(id, { ctx }) {
    if (!(await timesheetEmpPolicy.check(ctx, 'read'))) throw new ForbiddenError();
    return loadEmployee(ctx, id);
  },

  async permissions({ ctx }): Promise<FormPermissions> {
    const [update, del] = await Promise.all([timesheetEmpPolicy.check(ctx, 'update'), timesheetEmpPolicy.check(ctx, 'delete')]);
    return { create: false, update, delete: del };
  },

  canSubmit: ({ record }) => !!record,

  lookups: {
    MANAGER_ID: async ({ record }) => (record ? managerOptions(record) : []),
  },

  fields: [
    { name: 'REF_EMP_CD', label: 'Employee Code', type: 'text' },
    { name: 'EMP_NM', label: 'Employee', type: 'text' },
    { name: 'IS_MANAGER', label: 'Is Manager', type: 'checkbox' },
    { name: 'MANAGER_ID', label: 'Manager', type: 'select', optionsFrom: 'MANAGER_ID' },
  ],
  readonlyFields: ['REF_EMP_CD', 'EMP_NM'],

  toValues: (r) => ({
    REF_EMP_CD: r.REF_EMP_CD ?? '',
    EMP_NM: r.EMP_NM ?? '',
    IS_MANAGER: r.IS_MANAGER === '1',
    MANAGER_ID: r.MANAGER_ID || '',
  }),

  schema: { edit: timesheetEmployeeUpdateSchema },

  actions: { apiPath: EMP_API }, // PUT /api/timesheet/timesheet_emp/{id}
};

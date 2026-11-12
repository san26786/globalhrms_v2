import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { BusinessRuleError, ForbiddenError } from '@/lib/http/errors';
import type { ListScope } from '@/lib/listview/listDefinitions';
import { anyOf, menuPolicy } from '@/lib/resource/policies';
import { projectActionSchema } from '@/validations/timesheet.schema';
import { getMasterId } from '@/lib/masters/masterService';
import { EMP_CURRENT, PROJECT_TYPE } from './timesheet.constants';
import { timesheetPolicy, type ActionResult } from './timesheet.service';

/**
 * My Projects / Configure Projects — CI timesheet/timesheet::userProjects($userId) and its list
 * actions (setEnabledProject, disableProject, setDefaultProject, setCurrentProjects). Rows: every
 * project of the brand (user_project_details_vw) with the brand defaults (USER_ID 0 / none) and
 * the user's own settings. A user configures his own projects; an administrator a chosen employee's
 * (?userId=) or, without one, the brand defaults.
 *
 * Behaviour changes from CI: "Disable" on a project never configured stores it disabled (CI stored
 * it enabled); default / current are cleared within the brand only (CI cleared the user's other brands).
 */

export const projectsPolicy = anyOf(menuPolicy('timesheet/timesheet/userProjects'), timesheetPolicy);

const positive = (raw: string | undefined) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** CI userProjects $colNm: brand rows, limited to the defaults and the (chosen) user's settings. */
export async function projectsListScope(subject: RequestSubject, query: Record<string, string>): Promise<ListScope> {
  const brand = subject.oaBrandId ?? -1;
  const userId = subject.adminLevel === 0 ? subject.userId : positive(query.userId);
  return {
    equals: subject.adminLevel === 0 ? [{ column: 'OA_BRAND_ID', value: brand }] : [],
    ...(userId ? { in: { column: 'USER_ID', values: [0, userId], includeNull: true } } : {}),
  };
}

type Action = 'enable' | 'disable' | 'default' | 'current';

const MESSAGES: Record<Action, string> = {
  enable: 'Project(s) enabled successfully',
  disable: 'Project(s) disabled successfully',
  default: 'Project(s) set as default successfully',
  current: 'Project set as current successfully',
};

export async function projectAction(subject: RequestSubject, action: string, body: unknown): Promise<ActionResult> {
  if (!(['enable', 'disable', 'default', 'current'] as const).includes(action as Action)) throw new BusinessRuleError('Unknown action.');
  if (!(await projectsPolicy.check(subject, 'update'))) throw new ForbiddenError();
  const { ids, userId: requested } = projectActionSchema.parse(body);
  if (!ids.length) throw new BusinessRuleError('Please select project!!');
  if ((action === 'default' || action === 'current') && ids.length > 1) {
    throw new BusinessRuleError(`Only one project can be set as ${action}`);
  }
  const brandId = subject.oaBrandId;
  if (!brandId) throw new BusinessRuleError('Please select a brand first.');
  // CI: a user always works on his own settings; an administrator on the chosen employee's (or the brand defaults, 0).
  const userId = subject.adminLevel === 0 ? subject.userId : (requested ?? 0);

  const type = await prisma.common_type.findFirst({ where: { TYP_CD: PROJECT_TYPE }, select: { TYP_ID: true } });
  const projects = await prisma.independent_mst.findMany({
    where: { MSTR_ID: { in: ids }, TYP_ID: type?.TYP_ID ?? -1, OA_BRAND_ID: brandId },
    select: { MSTR_ID: true },
  });
  if (projects.length !== ids.length) throw new BusinessRuleError('Please select projects of your brand.');

  await assertInsertSafe('user_project_details', 'UPD_ID');
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (action === 'default') await tx.user_project_details.updateMany({ where: { USER_ID: userId, OA_BRAND_ID: brandId }, data: { IS_DEFAULT: 0 } });
    if (action === 'current') await tx.user_project_details.updateMany({ where: { USER_ID: userId, OA_BRAND_ID: brandId }, data: { IS_CURRENT: 0 } });
    for (const projectId of ids) {
      const set =
        action === 'enable' ? { IS_ENABLED: 1 } : action === 'disable' ? { IS_ENABLED: 0 } : action === 'default' ? { IS_DEFAULT: 1, IS_ENABLED: 1 } : { IS_CURRENT: 1, IS_ENABLED: 1 };
      const existing = await tx.user_project_details.findFirst({ where: { PROJECT_ID: projectId, USER_ID: userId }, select: { UPD_ID: true } });
      if (existing) {
        await tx.user_project_details.update({ where: { UPD_ID: existing.UPD_ID }, data: { ...set, IS_DELETED: 0, UPDATED_BY: subject.userId, UPDATED_ON: now } });
      } else {
        await tx.user_project_details.create({
          data: {
            PROJECT_ID: projectId,
            USER_ID: userId,
            OA_ID: subject.oaId,
            OA_BRAND_ID: brandId,
            IS_DELETED: 0,
            ...set,
            CREATED_BY: subject.userId,
            CREATED_ON: now,
            UPDATED_BY: subject.userId,
            UPDATED_ON: now,
          },
        });
      }
    }
  });
  return { message: MESSAGES[action as Action] };
}

/** CI userProjects T_EMP_ID dropdown (administrators): current employees of the brand, by user id. */
export async function projectEmployees(subject: RequestSubject): Promise<Array<{ value: string; label: string }>> {
  if (subject.adminLevel < 1 || !(await projectsPolicy.check(subject, 'list'))) throw new ForbiddenError();
  const current = await getMasterId(EMP_CURRENT);
  const rows = await prisma.$queryRaw<Array<{ REF_EMP_ID: number; EMP_NM: string | null }>>`
    SELECT DISTINCT "REF_EMP_ID", "EMP_NM" FROM timesheet_employee_vw
    WHERE "OABRANDID" = ${subject.oaBrandId ?? -1} AND "IS_DELETED" = 0 AND "EMP_STATUS_ID" = ${current ?? -1} AND "REF_EMP_ID" IS NOT NULL
    ORDER BY "EMP_NM"`;
  return rows.map((r) => ({ value: String(r.REF_EMP_ID), label: r.EMP_NM?.trim() || `#${r.REF_EMP_ID}` }));
}

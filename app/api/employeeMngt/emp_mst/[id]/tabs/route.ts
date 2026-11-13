import { NotFoundError } from '@/lib/http/errors';
import { ok } from '@/lib/http/respond';
import { readQuery, withApi } from '@/lib/http/withApi';
import { getEmployeeTabs } from '@/lib/navigation/navigationService';
import { prisma } from '@/lib/prisma';

/**
 * CI include/emp_tabs_v — GET /api/employeeMngt/emp_mst/{id}/tabs[?personal=team|me]: the employee's tab strip (Personal +
 * the caller's Employee Hub tabs). The employee must be in the caller's brand (sysadmin: any).
 */
export const GET = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('Record not found.');
  const [e] = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT "EMP_ID" AS id FROM emp_mst WHERE "EMP_ID" = ${id} AND "IS_DELETED" = 0
      AND (${subject.isSysAdmin} OR "OA_BRAND_ID" = ${subject.oaBrandId ?? -1})`;
  if (!e) throw new NotFoundError('Record not found.');
  const personal = readQuery(req).personal;
  const personalHref = personal === 'me' ? '/employeeMngt/emp_mst/myInfo'
    : personal === 'team' ? `/employeeMngt/emp_mst/MyTeamEmployee/edit/${id}` : `/employeeMngt/emp_mst/edit/${id}`;
  return ok({ tabs: await getEmployeeTabs(subject, id, personalHref) });
});

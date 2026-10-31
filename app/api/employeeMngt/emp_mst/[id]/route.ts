import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { empMstService } from '@/lib/employeeMngt/empMst';

/** CI employeeMngt/emp_mst — read (editEmployeeMst), update, delete (soft, admins) one employee in the caller's scope. */
export const GET = withApi<{ id: string }>(async ({ params, subject }) => empMstService.get(subject, params.id));

export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const result = await empMstService.update(subject, params.id, await readJson(req));
  return ok(result, { message: result.message });
});

export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => empMstService.remove(subject, params.id));

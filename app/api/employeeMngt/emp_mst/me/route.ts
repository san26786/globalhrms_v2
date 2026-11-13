import { NotFoundError } from '@/lib/http/errors';
import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { ownEmployeeId } from '@/lib/employeeMngt/empList';

/** CI employeeMngt/emp_mst/myInfo — GET: the caller's own employee in the active brand ({ id }). */
export const GET = withApi(async ({ subject }) => {
  const id = await ownEmployeeId(subject);
  if (!id) throw new NotFoundError('No employee record is linked to your login in this brand.');
  return ok({ id });
});

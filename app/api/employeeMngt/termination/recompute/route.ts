import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { terminationService } from '@/lib/employeeMngt/termination';

/** CI employeeMngt/termination/updateEmployeeStatus — POST: bring the employees' statuses up to date with their exit records (admins). */
export const POST = withApi(async ({ subject }) => {
  const result = await terminationService.recompute(subject);
  return ok(result, { message: result.message });
});

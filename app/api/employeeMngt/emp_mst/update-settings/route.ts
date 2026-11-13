import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { empReports } from '@/lib/employeeMngt/empReports';

/** CI emp_mst/updateEmployee — POST { ids }: "Update Employees with current settings" on the selected rows (admins). */
export const POST = withApi(async ({ req, subject }) => {
  const result = await empReports.updateSettings(subject, await readJson(req));
  return ok(result, { message: result.message });
});

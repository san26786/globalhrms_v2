import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { timesheetEmployeeService } from '@/lib/timesheet/timesheetEmployee';

/** PUT / DELETE /api/timesheet/timesheet_emp/{id} — CI timesheet_emp::update / ::delete. */
export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const result = await timesheetEmployeeService.update(subject, params.id, await readJson(req));
  return ok(result, { message: result.message });
});

export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => {
  const result = await timesheetEmployeeService.remove(subject, params.id);
  return ok(result, { message: result.message });
});

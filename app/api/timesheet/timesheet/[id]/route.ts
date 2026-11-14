import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { ForbiddenError } from '@/lib/http/errors';
import { loadTimesheet, timesheetPolicy, timesheetService } from '@/lib/timesheet/timesheet.service';

/** PUT / DELETE /api/timesheet/timesheet/{id} — CI timesheet/timesheet::update / ::delete. */
export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const result = await timesheetService.update(subject, params.id, await readJson(req));
  return ok(result, { message: result.message });
});

export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => {
  const result = await timesheetService.remove(subject, params.id);
  return ok(result, { message: result.message });
});

/** GET /api/timesheet/timesheet/{id} — the timesheet (same scope as the list). */
export const GET = withApi<{ id: string }>(async ({ params, subject }) => {
  if (!(await timesheetPolicy.check(subject, 'read'))) throw new ForbiddenError();
  return loadTimesheet(subject, params.id);
});

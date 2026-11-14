import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { timesheetItemService } from '@/lib/timesheet/timesheetItem.service';

/** PUT / DELETE /api/timesheet/timesheetItem/{id} — CI timesheetItem::update / ::delete. */
export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const result = await timesheetItemService.update(subject, params.id, await readJson(req));
  return ok(result, { message: result.message });
});

export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => {
  const result = await timesheetItemService.remove(subject, params.id);
  return ok(result, { message: result.message });
});

import { created } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { timesheetService } from '@/lib/timesheet/timesheet.service';

/**
 * POST /api/timesheet/timesheet — CI timesheet/timesheet::insert (Add New My Timesheet).
 * The list is GET /api/listview/timesheet (lib/listview/listDefinitions).
 */
export const POST = withApi(async ({ req, subject }) => {
  const result = await timesheetService.create(subject, await readJson(req));
  return created(result, { message: result.message });
});

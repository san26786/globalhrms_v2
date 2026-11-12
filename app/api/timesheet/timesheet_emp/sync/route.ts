import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { timesheetEmployeeService } from '@/lib/timesheet/timesheetEmployee';

/** POST /api/timesheet/timesheet_emp/sync — CI common/modulesync/syncit/timesheet_employee/{brand}/1 ("Sync Module"). */
export const POST = withApi(async ({ subject }) => {
  const result = await timesheetEmployeeService.sync(subject);
  return ok(result, { message: result.message });
});

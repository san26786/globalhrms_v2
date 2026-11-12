import { ForbiddenError } from '@/lib/http/errors';
import { readQuery, withApi } from '@/lib/http/withApi';
import { listMeta } from '@/lib/timesheet/timesheet.lists';
import { timesheetPolicy } from '@/lib/timesheet/timesheet.service';

/** GET ?team=1 — what the Timesheet list pages need besides the rows (titles, filters, dialogs, actions). */
export const dynamic = 'force-dynamic';

export const GET = withApi(async ({ req, subject }) => {
  if (!(await timesheetPolicy.check(subject, 'list'))) throw new ForbiddenError();
  return listMeta(subject, readQuery(req).team === '1');
});

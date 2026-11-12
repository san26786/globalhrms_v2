import { created } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { timesheetItemService } from '@/lib/timesheet/timesheetItem.service';

/**
 * POST /api/timesheet/timesheetItem — CI timesheetItem::insert (with TS_ID) and
 * new_timesheet_item::insert (without: the date's timesheet is found or created).
 * The list is GET /api/listview/timesheet_item.
 */
export const POST = withApi(async ({ req, subject }) => {
  const result = await timesheetItemService.create(subject, await readJson(req));
  return created(result, { message: result.message });
});

import { readQuery, withApi } from '@/lib/http/withApi';
import { timesheetItemService } from '@/lib/timesheet/timesheetItem.service';

/** GET ?date=YYYY-MM-DD — the timesheet period of a day (New Timesheet Item's read-only "Timesheet Period"). */
export const GET = withApi(async ({ req, subject }) => timesheetItemService.periodOfDay(subject, readQuery(req).date));

import { readQuery, withApi } from '@/lib/http/withApi';
import { timesheetItemService } from '@/lib/timesheet/timesheetItem.service';

/** GET ?start=HH:mm&end=HH:mm — CI calculateHrsDifference: { duration, unitId } for the item form. */
export const GET = withApi(async ({ req, subject }) => timesheetItemService.duration(subject, readQuery(req)));

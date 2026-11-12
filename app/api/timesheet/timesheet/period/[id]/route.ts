import { withApi } from '@/lib/http/withApi';
import { timesheetService } from '@/lib/timesheet/timesheet.service';

/** GET /api/timesheet/timesheet/period/{id} — CI dependablePeriodId: { startDate, endDate } of a timesheet period. */
export const GET = withApi<{ id: string }>(async ({ params, subject }) => timesheetService.periodDates(subject, params.id));

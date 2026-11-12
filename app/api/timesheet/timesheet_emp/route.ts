import { withApi } from '@/lib/http/withApi';
import { timesheetEmpFilters } from '@/lib/timesheet/timesheetEmployee';

/**
 * GET /api/timesheet/timesheet_emp — CI timesheet_emp::getCustomFields(): the Employment Status
 * filter of the list. The list itself is GET /api/listview/timesheet_emp.
 */
export const dynamic = 'force-dynamic';

export const GET = withApi(async ({ subject }) => timesheetEmpFilters(subject));

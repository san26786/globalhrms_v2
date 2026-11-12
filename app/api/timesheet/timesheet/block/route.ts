import { readQuery, withApi } from '@/lib/http/withApi';
import { blockData } from '@/lib/timesheet/timesheetBlock';

/** GET ?month=YYYY-MM&empId= — CI timesheetBlock: the month's timesheet periods with their timesheets. */
export const dynamic = 'force-dynamic';

export const GET = withApi(async ({ req, subject }) => blockData(subject, readQuery(req)));

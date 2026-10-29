import { withApi } from '@/lib/http/withApi';
import { getDashboardContext } from '@/lib/dashboard/context';
import { getTimesheetDashboardData } from '@/lib/dashboard/services/timesheetDashboardService';

export const dynamic = 'force-dynamic';

/** Scoped to the caller's verified brand; super admins (adminLevel 2) see every brand. */
export const GET = withApi(async ({ subject }) => getTimesheetDashboardData(getDashboardContext(subject)));

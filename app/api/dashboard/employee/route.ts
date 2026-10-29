import { withApi } from '@/lib/http/withApi';
import { getDashboardContext } from '@/lib/dashboard/context';
import { getEmployeeDashboardData } from '@/lib/dashboard/services/employeeDashboardService';

export const dynamic = 'force-dynamic'; // always fetch fresh KPI data, never statically cache

/** Scoped to the caller's verified brand; super admins (adminLevel 2) see every brand. */
export const GET = withApi(async ({ subject }) => getEmployeeDashboardData(getDashboardContext(subject)));

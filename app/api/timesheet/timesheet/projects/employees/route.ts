import { withApi } from '@/lib/http/withApi';
import { projectEmployees } from '@/lib/timesheet/userProjects';

/** GET — administrators: the brand's current employees keyed by user id (CI userProjects T_EMP_ID). */
export const dynamic = 'force-dynamic';

export const GET = withApi(async ({ subject }) => projectEmployees(subject));

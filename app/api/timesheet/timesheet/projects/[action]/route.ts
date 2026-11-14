import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { projectAction } from '@/lib/timesheet/userProjects';

/**
 * POST /api/timesheet/timesheet/projects/{enable|disable|default|current}  { ids, userId? }
 * CI setEnabledProject / disableProject / setDefaultProject / setCurrentProjects.
 */
export const POST = withApi<{ action: string }>(async ({ req, params, subject }) => {
  const result = await projectAction(subject, params.action, await readJson(req));
  return ok(result, { message: result.message });
});

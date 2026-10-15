import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { salaryComponentSettingsService as svc } from '@/lib/systmMngt/salaryComponentSettings';

/**
 * CI systmMngt/salary_component_settings — thin HTTP adapter (rules in lib/systmMngt/salaryComponentSettings).
 *   POST → CI insert(). The list is GET /api/listview/{key} (CI index → getTableDtl).
 */
export const POST = withApi(async ({ req, subject }) => {
  const result = await svc.save(subject, null, await readJson(req));
  return ok(result, { message: result.message });
});

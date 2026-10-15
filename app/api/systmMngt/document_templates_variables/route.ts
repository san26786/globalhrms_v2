import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { templateVariablesService as svc } from '@/lib/systmMngt/documentTemplates';

/**
 * CI systmMngt/document_templates_variables — thin HTTP adapter (rules in lib/systmMngt/documentTemplates).
 *   POST → CI insert(). The list is GET /api/listview/{key} (CI index → getTableDtl).
 */
export const POST = withApi(async ({ req, subject }) => {
  const result = await svc.save(subject, null, await readJson(req));
  return ok(result, { message: result.message });
});

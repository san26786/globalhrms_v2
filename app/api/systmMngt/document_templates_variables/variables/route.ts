import { readQuery, withApi } from '@/lib/http/withApi';
import { parseId } from '@/lib/systmMngt/shared';
import { templateVariablesService as svc } from '@/lib/systmMngt/documentTemplates';

/** GET ?templateId=&view=&id= — CI getVariables/{template}/{view}/{editId}: variable rows + the view's columns. */
export const GET = withApi(async ({ req, subject }) => {
  const q = readQuery(req);
  return svc.variables(subject, parseId(q.templateId), (q.view ?? '').slice(0, 200), q.id ? parseId(q.id) : null);
});

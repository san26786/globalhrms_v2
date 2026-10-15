import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { orgAccountsService as svc } from '@/lib/systmMngt/orgAccounts';
import { parseId } from '@/lib/systmMngt/shared';

/**
 * CI systmMngt/org_accounts — thin HTTP adapter (rules in lib/systmMngt/orgAccounts).
 *   GET → the form (CI editOrgAccounts/{id}) · PUT → CI update() · DELETE → CI delete/{id}
 * The list is GET /api/listview/org_accounts.
 */
export const GET = withApi<{ id: string }>(async ({ params, subject }) => svc.formInit(subject, parseId(params.id)));

export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const result = await svc.save(subject, parseId(params.id), await readJson(req));
  return ok(result, { message: result.message });
});

export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => {
  const result = await svc.remove(subject, parseId(params.id));
  return ok(result, { message: result.message });
});

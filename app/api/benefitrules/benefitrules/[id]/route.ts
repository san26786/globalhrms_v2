import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { benefitRulesService as svc } from '@/lib/benefitrules/benefitRules';

/** CI benefitrules/benefitrules — read (editbenefitrules), update, delete (soft) one rule. */
export const GET = withApi<{ id: string }>(async ({ params, subject }) => svc.get(subject, params.id));

export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const result = await svc.update(subject, params.id, await readJson(req));
  return ok(result, { message: result.message });
});

export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => svc.remove(subject, params.id));

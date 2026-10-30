import { created, ok } from '@/lib/http/respond';
import { readJson, readQuery, withApi } from '@/lib/http/withApi';
import { benefitRulesService as svc } from '@/lib/benefitrules/benefitRules';

/**
 * CI benefitrules/benefitrules — thin HTTP adapter (rules in lib/benefitrules).
 *   GET ?type=BRTYSBR|BRTYIDR|BRTYFDR|BRTYRBE&page&limit&search&sort&dir → the type's rules
 *   POST { type, …form } → CI insert($ruleTypeId)
 */
export const GET = withApi(async ({ req, subject }) => {
  const { rows, total, page, limit, permissions } = await svc.list(subject, readQuery(req));
  return ok(rows, { total, page, limit, permissions });
});

export const POST = withApi(async ({ req, subject }) => {
  const result = await svc.create(subject, await readJson(req));
  return created(result, { message: result.message });
});

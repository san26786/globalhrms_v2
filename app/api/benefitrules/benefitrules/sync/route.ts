import { ok } from '@/lib/http/respond';
import { readQuery, withApi } from '@/lib/http/withApi';
import { benefitRulesService as svc } from '@/lib/benefitrules/benefitRules';

/** CI benefitrules/benefitrules/sync_benefit_rules_settings — POST ?type=… (brand admins): copy the system default rules. */
export const POST = withApi(async ({ req, subject }) => {
  const result = await svc.sync(subject, readQuery(req).type ?? '');
  return ok(result, { message: result.message });
});

import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { oaBrandSettingsService as svc } from '@/lib/systmMngt/oaBrandSettings';

/**
 * CI systmMngt/oa_brand_settings — thin HTTP adapter (rules in lib/systmMngt/oaBrandSettings).
 *   POST { kind, attributeId, optionId | customValue + isCustom, brandId, refId, description, validation, isActive } → CI insert()
 * The list is GET /api/listview/oa_brand_settings?brandId=&type=ATTR.
 */
export const POST = withApi(async ({ req, subject }) => {
  const result = await svc.save(subject, null, await readJson(req));
  return ok(result, { message: result.message });
});

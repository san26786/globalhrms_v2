import { readJson, withApi } from '@/lib/http/withApi';
import { periodGenerateSchema } from '@/validations/utilities.schema';
import { authorizeScreen, resolveBrand } from '@/lib/utilities/access';
import { generatePeriods } from '@/lib/utilities/periodGenerator';

/**
 * POST /api/utilities/period_manager/generate { oaBrandId } — CI period_manager/generatePeriod
 * ("Sync Period"). Returns a per-period-type result list plus CI's flash messages.
 */
export const POST = withApi(async ({ req, subject }) => {
  await authorizeScreen(subject, 'period_manager', 'create');
  const input = periodGenerateSchema.parse(await readJson(req));
  const brand = await resolveBrand(subject, input.oaBrandId);
  return generatePeriods(subject, brand);
});

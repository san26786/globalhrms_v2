import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { periodService } from '@/lib/periodMngt';

/**
 * CI periodMngt/period_mst — thin HTTP adapter (rules live in lib/periodMngt).
 *   POST { periodTypeId, periodStartDate, periodEndDate, fiscalPeriodDesc } → CI insert()
 * The list is GET /api/listview/period_mst (CI index → getTableDtl).
 */
export const POST = withApi(async ({ req, subject }) => {
  const result = await periodService.save(subject, null, await readJson(req));
  return ok(result, { message: result.message });
});

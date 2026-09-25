import { created, ok } from '@/lib/http/respond';
import { readJson, readQuery, withApi } from '@/lib/http/withApi';
import { masterDataService } from '@/lib/common/masterData.service';

/**
 * CI common/indp_mst_data — list (index/{typeId}) and insert.
 *   GET  /api/common/master-data?typeId=230&page&limit&search&sort&dir
 *        → { success, data: rows, total, page, limit, permissions }   (no typeId = all masters)
 *   POST /api/common/master-data { typeId, code, name, description, countryId, parentId, globalSettingId, menuId, oaBrandId }
 */
export const GET = withApi(async ({ req, subject }) => {
  const result = await masterDataService.list(subject, readQuery(req));
  return ok(result.rows, { total: result.total, page: result.page, limit: result.limit, permissions: result.permissions });
});

export const POST = withApi(async ({ req, subject }) => created(await masterDataService.create(subject, await readJson(req))));

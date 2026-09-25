import { created, ok } from '@/lib/http/respond';
import { readJson, readQuery, withApi } from '@/lib/http/withApi';
import { commonTypeService } from '@/lib/common/commonType.service';

/**
 * CI common/common_type (System Entities) — list (system_entities_vw, de-duplicated) and insert.
 * List response: { success, data: rows, total, page, limit, permissions }.
 */
export const GET = withApi(async ({ req, subject }) => {
  const [result, permissions] = await Promise.all([
    commonTypeService.list(subject, readQuery(req)),
    commonTypeService.permissions(subject),
  ]);
  return ok(result.rows, { total: result.total, page: result.page, limit: result.limit, permissions });
});

export const POST = withApi(async ({ req, subject }) => created(await commonTypeService.create(subject, await readJson(req))));

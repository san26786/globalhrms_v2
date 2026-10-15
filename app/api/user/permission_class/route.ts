import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { permissionClassService } from '@/lib/user/permissionClass/permissionClass.service';

/**
 * POST — save a permission class (CI user/permission_dtl/insert → setFormControls). One upsert for
 * add and edit: `permissionClassId` set = replace that class's rows.
 * Body: { permissionClassName, permissionClassId?, oaId?, oaBrandId?, userId?, users[], userGroups[], roles[], functions[] }
 */
export const POST = withApi(async ({ req, subject }) => {
  const result = await permissionClassService.save(subject, await readJson(req));
  return ok(result, { message: result.message });
});

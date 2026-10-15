import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { permissionClassService } from '@/lib/user/permissionClass/permissionClass.service';

/** POST — reset the brand's permissions to the application defaults (CI sync_permissions; brand admins only). */
export const POST = withApi(async ({ subject }) => {
  const result = await permissionClassService.sync(subject);
  return ok(result, { message: result.message });
});

import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { permissionClassService } from '@/lib/user/permissionClass/permissionClass.service';

/** DELETE — remove a class's permission rows in the active brand (CI user/permission_class/delete/{id}). */
export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => {
  const result = await permissionClassService.remove(subject, params.id);
  return ok(result, { message: result.message });
});

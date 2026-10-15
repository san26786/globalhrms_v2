import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { permissionDtlService } from '@/lib/user/permissionClass/permissionClass.service';

/** DELETE — soft-delete one permission_dtl row (CI Delete Selected → common_c::softDelete). */
export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => {
  const result = await permissionDtlService.softDelete(subject, params.id);
  return ok(result, { message: result.message });
});

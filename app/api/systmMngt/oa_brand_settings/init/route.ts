import { readQuery, withApi } from '@/lib/http/withApi';
import { kindOf, oaBrandSettingsService as svc } from '@/lib/systmMngt/oaBrandSettings';
import { parseId } from '@/lib/systmMngt/shared';

/** GET ?id=&type=ATTR&brandId= — CI initForm($id, $brandId, $type). */
export const GET = withApi(async ({ req, subject }) => {
  const q = readQuery(req);
  return svc.formInit(subject, q.id ? parseId(q.id) : null, kindOf(q.type), q.brandId ? parseId(q.brandId) : null);
});

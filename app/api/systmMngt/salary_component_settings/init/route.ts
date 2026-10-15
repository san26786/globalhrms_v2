import { readQuery, withApi } from '@/lib/http/withApi';
import { parseId } from '@/lib/systmMngt/shared';
import { salaryComponentSettingsService as svc } from '@/lib/systmMngt/salaryComponentSettings';

/** GET ?id= — CI initForm($id): title, dropdowns and (edit) the record. */
export const GET = withApi(async ({ req, subject }) => {
  const raw = readQuery(req).id;
  return svc.formInit(subject, raw ? parseId(raw) : null);
});

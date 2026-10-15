import { readQuery, withApi } from '@/lib/http/withApi';
import { parseId } from '@/lib/systmMngt/shared';
import { companyDocumentsService as svc } from '@/lib/systmMngt/companyDocuments';

/** GET ?id= — the form (CI member_file_upload initForm, BRAND_ID path). */
export const GET = withApi(async ({ req, subject }) => {
  const raw = readQuery(req).id;
  return svc.formInit(subject, raw ? parseId(raw) : null);
});

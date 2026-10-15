import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { parseId } from '@/lib/systmMngt/shared';
import { companyDocumentsService as svc } from '@/lib/systmMngt/companyDocuments';

/** PUT multipart → CI member_file_upload update · DELETE → CI company_documents/delete/{id}. */
export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const result = await svc.save(subject, parseId(params.id), await req.formData());
  return ok(result, { message: result.message });
});

export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => {
  const result = await svc.remove(subject, parseId(params.id));
  return ok(result, { message: result.message });
});

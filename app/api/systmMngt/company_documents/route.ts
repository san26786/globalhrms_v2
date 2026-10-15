import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { companyDocumentsService as svc } from '@/lib/systmMngt/companyDocuments';

/**
 * CI systmMngt/company_documents — thin HTTP adapter (rules in lib/systmMngt/companyDocuments).
 *   POST multipart { fileName, docCategory, master, isPublic, userGroup, userfile } → CI member_file_upload insert
 * The list is GET /api/listview/company_documents.
 */
export const POST = withApi(async ({ req, subject }) => {
  const result = await svc.save(subject, null, await req.formData());
  return ok(result, { message: result.message });
});

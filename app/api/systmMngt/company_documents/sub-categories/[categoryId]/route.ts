import { withApi } from '@/lib/http/withApi';
import { parseId } from '@/lib/systmMngt/shared';
import { companyDocumentsService as svc } from '@/lib/systmMngt/companyDocuments';

/** GET — CI member_file_upload/getMastersByCategory/{id}: the category's sub categories. */
export const GET = withApi<{ categoryId: string }>(async ({ params, subject }) => svc.subCategories(subject, parseId(params.categoryId)));

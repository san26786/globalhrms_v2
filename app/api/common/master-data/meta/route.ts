import { readQuery, withApi } from '@/lib/http/withApi';
import { masterDataService } from '@/lib/common/masterData.service';
import { masterTypeQuerySchema } from '@/validations/common.schema';

/**
 * GET /api/common/master-data/meta?typeId=230 — what the list/form pages need about the type:
 * title (common_type.TYP_NM, "Masters" without a type), system/user data type, code prefix,
 * default country, whether "Sync Masters" is offered and the caller's permissions.
 */
export const GET = withApi(async ({ req, subject }) => {
  const { typeId } = masterTypeQuerySchema.parse(readQuery(req));
  return masterDataService.meta(subject, typeId);
});

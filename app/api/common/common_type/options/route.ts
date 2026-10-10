import { z } from 'zod';
import { readQuery, withApi } from '@/lib/http/withApi';
import { commonTypeService } from '@/lib/common/commonType.service';
import { masterDataService } from '@/lib/common/masterData.service';

/**
 * GET /api/common/common_type/options?kind=data-types|parent-types — System Entity form dropdowns
 * (CI common_type_m::getAllDataType / getAllCommonTypeDetails).
 */
const querySchema = z.object({ kind: z.enum(['data-types', 'parent-types']) });

export const GET = withApi(async ({ req, subject }) => {
  const { kind } = querySchema.parse(readQuery(req));
  return kind === 'data-types' ? commonTypeService.dataTypeOptions(subject) : masterDataService.typeOptions(subject);
});

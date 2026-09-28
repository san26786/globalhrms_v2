import { withApi } from '@/lib/http/withApi';
import { NotFoundError } from '@/lib/http/errors';
import { displayConfigService } from '@/lib/entity/display/displayConfig.service';
import { findActiveObjectByName } from '@/lib/entity/entityShared';

/**
 * POST — CI common_c::resetLabelAsDefault/{pvs_ObjNm}: the caller's brand labels revert to the
 * system labels. Returns { updated, config }.
 */
export const POST = withApi<{ objNm: string }>(async ({ params, subject }) => {
  const obj = await findActiveObjectByName(decodeURIComponent(params.objNm));
  if (!obj) throw new NotFoundError('This list has no column configuration.');
  return displayConfigService.resetToDefault(subject, String(obj.OBJ_ID));
});

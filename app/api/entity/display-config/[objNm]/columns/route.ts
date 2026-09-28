import { withApi } from '@/lib/http/withApi';
import { displayConfigService, type ListColumn } from '@/lib/entity/display/displayConfig.service';
import { findActiveObjectByName } from '@/lib/entity/entityShared';

/**
 * GET — the list columns (label + list/form visibility) the caller sees for an object
 * (CI getTableDtl tableHeader). Any logged-in user; [] when the object has no entity definition,
 * in which case the list keeps the columns it declares itself.
 */
export const GET = withApi<{ objNm: string }>(async ({ params, subject }): Promise<ListColumn[]> => {
  const obj = await findActiveObjectByName(decodeURIComponent(params.objNm));
  if (!obj) return [];
  return displayConfigService.columns(subject, String(obj.OBJ_ID));
});

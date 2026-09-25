import { readQuery, withApi } from '@/lib/http/withApi';
import { masterDataService } from '@/lib/common/masterData.service';
import { masterOptionsQuerySchema } from '@/validations/common.schema';

/**
 * GET /api/common/master-data/options?kind=…&typeId= — dropdowns of the master-data screens:
 *   types            System Entity filter / Type select (CI getAllCommonTypeDetails, caller-scoped)
 *   parents          parent masters of a type (CI getDependentParentDropdown / hier_level_config)
 *   countries        location_mst countries of the active brand (CI getAllLocMstDD(COUNTRY))
 *   global-settings  Global Setting Items (type 36)
 *   menus            menu items for Module Function / Functional Epic types (CI getDependentMenuDropdown)
 */
export const GET = withApi(async ({ req, subject }) => {
  const { kind, typeId } = masterOptionsQuerySchema.parse(readQuery(req));
  return masterDataService.options(subject, kind, typeId);
});

import { readJson, withApi } from '@/lib/http/withApi';
import { masterDataService } from '@/lib/common/masterData.service';
import { masterSyncSchema } from '@/validations/common.schema';

/** POST /api/common/master-data/sync { typeId } — CI indp_mst_data/replicateMstrForBrand/{typeId} ("Sync Masters"). */
export const POST = withApi(async ({ req, subject }) => {
  const { typeId } = masterSyncSchema.parse(await readJson(req));
  return masterDataService.syncForBrand(subject, typeId);
});

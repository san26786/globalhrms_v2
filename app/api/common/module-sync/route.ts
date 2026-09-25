import { readJson, withApi } from '@/lib/http/withApi';
import { moduleSyncService } from '@/lib/common/moduleSync.service';

/**
 * CI common/modulesync ("Sync Employee Details").
 *   GET  → { modules: [{ value, label }], canChooseBrand }
 *   POST { module, oaBrandId? } → CI syncit/{table}/{oa_brand_id}
 */
export const GET = withApi(async ({ subject }) => moduleSyncService.modules(subject));

export const POST = withApi(async ({ req, subject }) => moduleSyncService.sync(subject, await readJson(req)));

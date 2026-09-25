import { readJson, withApi } from '@/lib/http/withApi';
import { masterDataService } from '@/lib/common/masterData.service';

/** CI common/indp_mst_data — editIndependentData / update / deleteIndpMstData (soft). */
export const GET = withApi<{ id: string }>(async ({ params, subject }) => masterDataService.get(subject, params.id));

export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) =>
  masterDataService.update(subject, params.id, await readJson(req)),
);

export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => masterDataService.remove(subject, params.id));

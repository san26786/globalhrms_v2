import { readJson, withApi } from '@/lib/http/withApi';
import { commonTypeService } from '@/lib/common/commonType.service';

/** CI common/common_type — editCommonType / update / deleteCommonType (soft, refused while referenced). */
export const GET = withApi<{ id: string }>(async ({ params, subject }) => commonTypeService.get(subject, params.id));

export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) =>
  commonTypeService.update(subject, params.id, await readJson(req)),
);

export const DELETE = withApi<{ id: string }>(async ({ params, subject }) => commonTypeService.remove(subject, params.id));

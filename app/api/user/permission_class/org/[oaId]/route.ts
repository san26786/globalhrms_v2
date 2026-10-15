import { withApi } from '@/lib/http/withApi';
import { permissionClassService } from '@/lib/user/permissionClass/permissionClass.service';

/** GET — users / user groups / roles of an organisation (CI getUserListForOaId/{OaId}). */
export const dynamic = 'force-dynamic';

export const GET = withApi<{ oaId: string }>(async ({ params, subject }) => permissionClassService.orgOptions(subject, params.oaId));

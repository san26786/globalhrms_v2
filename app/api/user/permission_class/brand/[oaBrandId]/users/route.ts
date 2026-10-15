import { withApi } from '@/lib/http/withApi';
import { permissionClassService } from '@/lib/user/permissionClass/permissionClass.service';

/** GET — "Requested By" users of a brand (CI oa_brands/dependableUserBasedOnOrgBrand). */
export const dynamic = 'force-dynamic';

export const GET = withApi<{ oaBrandId: string }>(async ({ params, subject }) =>
  permissionClassService.brandUsers(subject, params.oaBrandId),
);

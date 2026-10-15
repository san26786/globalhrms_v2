import { readQuery, withApi } from '@/lib/http/withApi';
import { permissionClassService } from '@/lib/user/permissionClass/permissionClass.service';

/** GET ?q= — class-name suggestions [{ value, label }] (CI smartSearchPermissionClass). */
export const dynamic = 'force-dynamic';

export const GET = withApi(async ({ req, subject }) => permissionClassService.search(subject, readQuery(req).q ?? ''));

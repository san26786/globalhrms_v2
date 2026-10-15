import { readQuery, withApi } from '@/lib/http/withApi';
import { permissionClassService } from '@/lib/user/permissionClass/permissionClass.service';

/**
 * GET ?classId= — everything the add / edit form needs (CI initForm + getAllPermission +
 * get_enabled_module): org / brand / user, ref-type ids, user / group / role options, the whole
 * function tree, and the class's current selection.
 */
export const dynamic = 'force-dynamic';

export const GET = withApi(async ({ req, subject }) => permissionClassService.init(subject, readQuery(req).classId || null));

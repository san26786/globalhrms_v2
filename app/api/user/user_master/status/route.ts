import { readJson, withApi } from '@/lib/http/withApi';
import { userMasterService } from '@/lib/user/userMaster.service';

/**
 * POST /api/user/user_master/status { action: 'activate' | 'deactivate' | 'activate-suspended', ids }
 * CI user_change_status/{USA|USD}, single_user_change_status and user_suspend_status (admins only).
 */
export const POST = withApi(async ({ req, subject }) => userMasterService.changeStatus(subject, await readJson(req)));

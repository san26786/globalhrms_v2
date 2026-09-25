import { withApi } from '@/lib/http/withApi';
import { userMasterService } from '@/lib/user/userMaster.service';

/** GET /api/user/user_master/meta — what the caller may do on the User Master screens. */
export const GET = withApi(async ({ subject }) => userMasterService.capabilities(subject));

import { withApi } from '@/lib/http/withApi';
import { loginAuditService } from '@/lib/auth/loginAuditService';

/** CI user/login_details — users currently online (sysadmin: all, admin: own brand, user: self). */
export const GET = withApi(async ({ subject }) => loginAuditService.onlineUsers(subject));

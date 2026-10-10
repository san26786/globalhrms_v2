import { withApi } from '@/lib/http/withApi';
import { loginAuditService } from '@/lib/auth/loginAuditService';

/** CI user/login_attempts — the caller's own recent logins. */
export const GET = withApi(async ({ subject }) => loginAuditService.myLoginHistory(subject));

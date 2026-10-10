import { withApi } from '@/lib/http/withApi';
import { getAccessPayload } from '@/lib/auth/getAccessPayload';
import { loginAuditService } from '@/lib/auth/loginAuditService';

/** CI user/login_attempts/activeSessions — the caller's own online sessions ("This session" flagged). */
export const GET = withApi(async ({ req, subject }) =>
  loginAuditService.myActiveSessions(subject, getAccessPayload(req)?.sid),
);

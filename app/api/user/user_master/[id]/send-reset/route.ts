import { withApi } from '@/lib/http/withApi';
import { appBaseUrl, issuePasswordReset } from '@/lib/auth/passwordReset';
import { userMasterService } from '@/lib/user/userMaster.service';

/**
 * POST /api/user/user_master/{id}/send-reset — CI user_master::sendPasswordMail(userId).
 * The target must be inside the caller's scope; the mail itself is the shared reset flow
 * (single-use token instead of CI's base64(USER_ID) link). Returns { email }.
 */
export const POST = withApi<{ id: string }>(async ({ req, params, subject }) => {
  const user = await userMasterService.assertActionTarget(subject, params.id);
  return issuePasswordReset(user.id, appBaseUrl(req.nextUrl.origin));
});

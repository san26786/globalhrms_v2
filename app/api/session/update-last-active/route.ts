import { withApi } from '@/lib/http/withApi';
import { getAccessPayload } from '@/lib/auth/getAccessPayload';
import { touchLastActive } from '@/lib/auth/session-activity';

/**
 * Port of login/login/updateUserLastActive (called every 8 minutes by the header): keeps this
 * browser's concurrent_login_details row alive so the 20-minute idle rule does not expire it.
 */
export const POST = withApi(async ({ req, subject }) => {
  const sid = getAccessPayload(req)?.sid;
  const updated = await touchLastActive(subject.userId, sid);
  return { ok: true, updated };
});

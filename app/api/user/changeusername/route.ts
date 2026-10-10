import { authConfig } from '@/lib/auth/authConfig';
import { getAccessPayload } from '@/lib/auth/getAccessPayload';
import { signAccessToken } from '@/lib/auth/jwt';
import { accountService } from '@/lib/auth/accountService';
import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { changeUsernameSchema } from '@/validations/account.schema';

/**
 * CI user/changeusername/editChangeusername. On success CI updated session('username'); here the
 * access token is re-issued with the new username (everything else in the token is unchanged).
 */
export const POST = withApi(async ({ req, subject }) => {
  const result = await accountService.changeUsername(subject, changeUsernameSchema.parse(await readJson(req)));
  const response = ok(result);
  const payload = getAccessPayload(req);
  if (payload) {
    response.cookies.set(
      authConfig.accessTokenCookie,
      signAccessToken({
        sub: payload.sub,
        username: result.username,
        isAdmin: payload.isAdmin,
        isSysAdmin: payload.isSysAdmin,
        oaId: payload.oaId,
        oaBrandId: payload.oaBrandId,
        sid: payload.sid,
        pla: payload.pla ?? null,
      }),
      { ...authConfig.cookie, maxAge: authConfig.accessTokenExpiresInSeconds },
    );
  }
  return response;
});

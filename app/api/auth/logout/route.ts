import { NextResponse } from "next/server";
import { revokeSession } from "@/lib/auth/session-repository";
import { verifyRefreshToken } from "@/lib/auth/jwt";
import { authConfig } from "@/lib/auth/authConfig";
import { endLoginSession } from "@/lib/auth/session-activity";
import { withPublicApi } from "@/lib/http/withApi";

/**
 * CI login/login/logout: session offline (IS_ONLINE = 0 for this session), concurrent count
 * recomputed, session destroyed. Always clears the cookies, even if bookkeeping fails.
 */
export const POST = withPublicApi(async ({ req }) => {
  const refreshToken = req.cookies.get(authConfig.refreshTokenCookie)?.value;
  const payload = refreshToken ? verifyRefreshToken(refreshToken) : null;

  if (refreshToken && payload) {
    try {
      await revokeSession(refreshToken);
      await endLoginSession(Number(payload.sub), payload.sid);
    } catch (error) {
      console.error("[auth] logout bookkeeping failed", error);
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(authConfig.accessTokenCookie);
  response.cookies.delete(authConfig.refreshTokenCookie);
  response.cookies.delete(authConfig.activeBrandCookie);
  return response;
});

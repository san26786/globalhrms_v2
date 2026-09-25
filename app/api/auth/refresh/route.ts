import { NextResponse } from "next/server";
import { verifyRefreshToken, signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { createSession, findValidSession, revokeSession } from "@/lib/auth/session-repository";
import { authConfig } from "@/lib/auth/authConfig";
import { prisma } from "@/lib/prisma";
import { parseActiveBrandCookie, resolveBrandAccess } from "@/lib/auth/activeBrand";
import { USER_STATUS, userStatusCode } from "@/lib/auth/userStatus";
import { fail } from "@/lib/http/respond";
import { withPublicApi } from "@/lib/http/withApi";

/** Account states that end every session (CI refused these at login). */
const BLOCKED_STATUSES = new Set<string>([USER_STATUS.INACTIVE, USER_STATUS.PENDING_ACTIVATION, USER_STATUS.DEACTIVATED]);

/**
 * Renews the 15-minute access token. The refresh token is rotated on every use (the old one is
 * revoked), and a user who was deactivated/suspended/deleted since logging in is signed out.
 */
export const POST = withPublicApi(async ({ req }) => {
  const unauthorized = () => {
    const res = fail(401, "Your session has expired. Please log in again.", "UNAUTHORIZED");
    res.cookies.delete(authConfig.accessTokenCookie);
    res.cookies.delete(authConfig.refreshTokenCookie);
    return res;
  };

  const refreshToken = req.cookies.get(authConfig.refreshTokenCookie)?.value;
  const payload = refreshToken ? verifyRefreshToken(refreshToken) : null;
  if (!refreshToken || !payload) return unauthorized();

  const session = await findValidSession(refreshToken);
  if (!session) return unauthorized();

  const user = await prisma.user_mst.findFirst({
    where: { USER_ID: Number(payload.sub) },
    select: {
      USER_ID: true,
      USER_NAME: true,
      IS_ADMIN: true,
      IS_SYSADMIN: true,
      IS_DELETED: true,
      ACTIVATION: true,
      USER_STATUS_ID: true,
      OA_ID: true,
      OA_BRAND_ID: true,
    },
  });
  const status = user ? await userStatusCode(user.USER_STATUS_ID) : null;
  if (!user || user.IS_DELETED || user.ACTIVATION || (status && BLOCKED_STATUSES.has(status))) {
    await revokeSession(refreshToken);
    return unauthorized();
  }

  // Keep a brand the user switched to, but only if they are still allowed to be in it.
  let oaBrandId = user.OA_BRAND_ID;
  const switchedTo = parseActiveBrandCookie(req.cookies.get(authConfig.activeBrandCookie)?.value, user.USER_ID);
  if (switchedTo !== null && switchedTo !== user.OA_BRAND_ID) {
    const access = await resolveBrandAccess(
      { isSysAdmin: user.IS_SYSADMIN, isAdmin: user.IS_ADMIN, oaId: user.OA_ID, oaBrandId: user.OA_BRAND_ID },
      switchedTo,
    );
    if (access.ok) oaBrandId = access.brand.id;
  }

  const accessToken = signAccessToken({
    sub: String(user.USER_ID),
    username: user.USER_NAME,
    isAdmin: user.IS_ADMIN,
    isSysAdmin: user.IS_SYSADMIN,
    oaId: user.OA_ID,
    oaBrandId,
    sid: payload.sid,
    pla: payload.pla ?? null,
  });

  // Rotation: the presented refresh token can be used only once.
  const nextRefresh = signRefreshToken({ sub: String(user.USER_ID), sid: payload.sid, pla: payload.pla ?? null });
  await createSession(user.USER_ID, nextRefresh);
  await revokeSession(refreshToken);

  const response = NextResponse.json({ success: true });
  response.cookies.set(authConfig.accessTokenCookie, accessToken, {
    ...authConfig.cookie,
    maxAge: authConfig.accessTokenExpiresInSeconds,
  });
  response.cookies.set(authConfig.refreshTokenCookie, nextRefresh, {
    ...authConfig.cookie,
    maxAge: authConfig.refreshTokenExpiresInSeconds,
  });
  return response;
});

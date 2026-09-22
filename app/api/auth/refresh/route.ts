import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshToken, signAccessToken } from "@/lib/auth/jwt";
import { findValidSession } from "@/lib/auth/session-repository";
import { authConfig } from "@/lib/auth/authConfig";
import { prisma } from "@/lib/prisma";
import { parseActiveBrandCookie, resolveBrandAccess } from "@/lib/auth/activeBrand";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(authConfig.refreshTokenCookie)?.value;
  if (!refreshToken) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const session = await findValidSession(refreshToken);
  if (!session) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const user = await prisma.user_mst.findUnique({ where: { USER_ID: Number(payload.sub) } });
  if (!user || user.IS_DELETED) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  // Keep a brand the user switched to, but only if they are still allowed to be in it.
  let oaBrandId = user.OA_BRAND_ID;
  const switchedTo = parseActiveBrandCookie(
    request.cookies.get(authConfig.activeBrandCookie)?.value,
    user.USER_ID
  );
  if (switchedTo !== null && switchedTo !== user.OA_BRAND_ID) {
    const access = await resolveBrandAccess(
      {
        isSysAdmin: user.IS_SYSADMIN,
        isAdmin: user.IS_ADMIN,
        oaId: user.OA_ID,
        oaBrandId: user.OA_BRAND_ID,
      },
      switchedTo
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
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set(authConfig.accessTokenCookie, accessToken, {
    ...authConfig.cookie,
    maxAge: 15 * 60,
  });
  return response;
}
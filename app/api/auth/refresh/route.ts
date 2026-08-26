import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshToken, signAccessToken } from "@/lib/auth/jwt";
import { findValidSession } from "@/lib/auth/session-repository";
import { authConfig } from "@/lib/auth/authConfig";
import { prisma } from "@/lib/prisma";

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

  const accessToken = signAccessToken({
    sub: String(user.USER_ID),
    username: user.USER_NAME,
    isAdmin: user.IS_ADMIN,
    isSysAdmin: user.IS_SYSADMIN,
    oaBrandId: user.OA_BRAND_ID ? String(user.OA_BRAND_ID) : null,
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set(authConfig.accessTokenCookie, accessToken, {
    ...authConfig.cookie,
    maxAge: 15 * 60,
  });
  return response;
}
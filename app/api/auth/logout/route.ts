import { NextRequest, NextResponse } from "next/server";
import { revokeSession } from "@/lib/auth/session-repository";
import { markLogout } from "@/lib/auth/auth-repository";
import { verifyRefreshToken } from "@/lib/auth/jwt";
import { authConfig } from "@/lib/auth/authConfig";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(authConfig.refreshTokenCookie)?.value;

  if (refreshToken) {
    const payload = verifyRefreshToken(refreshToken);
    if (payload) {
      await revokeSession(refreshToken);
      await markLogout(Number(payload.sub));
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(authConfig.accessTokenCookie);
  response.cookies.delete(authConfig.refreshTokenCookie);
  return response;
}
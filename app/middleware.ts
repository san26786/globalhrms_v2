import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";

const accessTokenCookie = "globalhr_access_token";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(accessTokenCookie)?.value;
  const payload = token ? verifyAccessToken(token) : null;

  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/system/:path*",
    "/common/:path*",
    "/modules/:path*",
  ],
};
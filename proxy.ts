import { NextResponse, type NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { authConfig } from '@/lib/auth/authConfig';

/**
 * Page-level authentication (CI: CI_Controller::is_logged_in()).
 *
 * Next 16 loads this file only from the project root and only under the name `proxy`
 * (the old app/middleware.ts was never executed). Every page is protected except the public
 * login flows under /login. API routes are excluded from the matcher on purpose: each one
 * authenticates itself (lib/http/withApi) and must answer 401 JSON, not a redirect.
 *
 * An expired access token is not a logout: when a refresh-token cookie is present the request
 * is let through and the client's authFetch renews the access token on its first API call —
 * every API call is still verified server-side.
 */
export function proxy(request: NextRequest) {
  const access = request.cookies.get(authConfig.accessTokenCookie)?.value;
  if (access && verifyAccessToken(access)) return NextResponse.next();
  if (request.cookies.get(authConfig.refreshTokenCookie)?.value) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  const from = request.nextUrl.pathname + request.nextUrl.search;
  if (from && from !== '/') loginUrl.searchParams.set('from', from);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // everything except: API routes, Next internals, static files, and the public /login pages
    '/((?!api|_next/static|_next/image|favicon.ico|login|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?)$).*)',
  ],
};

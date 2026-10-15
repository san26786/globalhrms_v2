import { NextResponse, type NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { authConfig } from '@/lib/auth/authConfig';
import { parseHref, resolveCiUrl } from '@/lib/navigation/routeRegistry';

/**
 * Page-level authentication (CI: CI_Controller::is_logged_in()) + old CodeIgniter URLs.
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

/**
 * Old CI URLs (bookmarks, e-mailed links), e.g. /bankmanager/bankdetails or
 * /common/indp_mst_data/index/57, redirect to the Next route of the same screen. Only paths the
 * route registry maps to a DIFFERENT path are redirected; everything else (every real Next
 * route) passes through untouched. (This used to be an app/(dashboard)/[...legacy] catch-all
 * page, but in `next dev` that catch-all shadowed static pages three or more segments deep —
 * /user/role_master/add returned 404.)
 */
function legacyRedirect(request: NextRequest): NextResponse | null {
  const { pathname, searchParams } = request.nextUrl;
  const resolved = resolveCiUrl(pathname);
  if (resolved.kind !== 'internal') return null;
  const target = parseHref(resolved.href);
  const current = pathname.replace(/\/+$/, '') || '/';
  if (target.path === current) return null;

  const url = request.nextUrl.clone();
  url.pathname = target.path;
  // Keep the caller's query parameters; the target's own parameters (e.g. typeId) win.
  const merged = new URLSearchParams(searchParams);
  for (const [key, value] of target.query) merged.set(key, value);
  url.search = merged.toString();
  return NextResponse.redirect(url);
}

export function proxy(request: NextRequest) {
  const access = request.cookies.get(authConfig.accessTokenCookie)?.value;
  const authenticated =
    (!!access && !!verifyAccessToken(access)) || !!request.cookies.get(authConfig.refreshTokenCookie)?.value;

  if (authenticated) return legacyRedirect(request) ?? NextResponse.next();

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

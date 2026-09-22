import { NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth/authConfig';
import { signAccessToken } from '@/lib/auth/jwt';
import { getAccessPayload } from '@/lib/auth/getAccessPayload';
import { formatActiveBrandCookie, resolveBrandAccess } from '@/lib/auth/activeBrand';
import { findHeaderUser } from '@/lib/header/header-repository';

/**
 * POST { oaBrandId: number } — switch the active brand.
 * Re-checks permission server-side, re-issues the access token with the new brand, and
 * remembers the choice in a cookie so /api/auth/refresh keeps it (see lib/auth/activeBrand.ts).
 * The client must reload afterwards: menus and page data are brand-scoped.
 */
export async function POST(request: NextRequest) {
  const payload = getAccessPayload(request);
  if (!payload) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const oaBrandId = Number(body?.oaBrandId);
  if (!Number.isInteger(oaBrandId) || oaBrandId <= 0) {
    return NextResponse.json({ success: false, message: 'A valid brand is required.' }, { status: 400 });
  }

  const userId = Number(payload.sub);
  const user = await findHeaderUser(userId);
  if (!user || user.IS_DELETED) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const access = await resolveBrandAccess(
    { isSysAdmin: user.IS_SYSADMIN, isAdmin: user.IS_ADMIN, oaId: user.OA_ID, oaBrandId: user.OA_BRAND_ID },
    oaBrandId
  );
  if (!access.ok) {
    const status = access.reason === 'not_found' ? 404 : 403;
    return NextResponse.json(
      { success: false, message: access.reason === 'not_found' ? 'Brand not found.' : 'You cannot switch to this brand.' },
      { status }
    );
  }

  const accessToken = signAccessToken({
    sub: String(user.USER_ID),
    username: user.USER_NAME,
    isAdmin: user.IS_ADMIN,
    isSysAdmin: user.IS_SYSADMIN,
    oaId: user.OA_ID,
    oaBrandId: access.brand.id,
  });

  const response = NextResponse.json({ success: true, brand: { id: access.brand.id, name: access.brand.name } });
  response.cookies.set(authConfig.accessTokenCookie, accessToken, {
    ...authConfig.cookie,
    maxAge: authConfig.accessTokenExpiresInSeconds,
  });
  response.cookies.set(authConfig.activeBrandCookie, formatActiveBrandCookie(user.USER_ID, access.brand.id), {
    ...authConfig.cookie,
    maxAge: authConfig.refreshTokenExpiresInSeconds,
  });
  return response;
}

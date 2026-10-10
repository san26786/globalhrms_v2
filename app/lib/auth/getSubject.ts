/**
 * app/lib/auth/getSubject.ts
 *
 * The single adapter from the verified access-token cookie to the identity every
 * API route / service works with. Nothing else should read the token directly.
 *
 * `adminLevel` reproduces CI's numeric `$this->session->userdata('is_admin')`:
 *   2 = system admin (user_mst.IS_SYSADMIN), 1 = org/brand admin (IS_ADMIN), 0 = user.
 * CI branches on this value everywhere (list scoping, who may configure what), so it
 * is resolved once here instead of being re-derived per module.
 */
import type { NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { authConfig } from '@/lib/auth/authConfig';
import { toIntOrNull } from '@/lib/auth/getAccessPayload';
import { UnauthorizedError } from '@/lib/http/errors';
import type { PermissionSubject } from '@/lib/permission';

export type AdminLevel = 0 | 1 | 2;

export interface RequestSubject extends PermissionSubject {
  username: string;
  adminLevel: AdminLevel;
  oaId: number | null;
  oaBrandId: number | null;
}

export function toAdminLevel(flags: { isAdmin: boolean; isSysAdmin: boolean }): AdminLevel {
  if (flags.isSysAdmin) return 2;
  if (flags.isAdmin) return 1;
  return 0;
}

export async function getSubjectFromRequest(req: NextRequest): Promise<RequestSubject | null> {
  const token = req.cookies.get(authConfig.accessTokenCookie)?.value;
  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const isAdmin = Boolean(payload.isAdmin);
  const isSysAdmin = Boolean(payload.isSysAdmin);

  return {
    userId: Number(payload.sub),
    username: payload.username,
    isAdmin,
    isSysAdmin,
    adminLevel: toAdminLevel({ isAdmin, isSysAdmin }),
    oaId: toIntOrNull(payload.oaId),
    oaBrandId: toIntOrNull(payload.oaBrandId),
  };
}

/** Same as getSubjectFromRequest, but throws a 401 AppError when the caller is not logged in. */
export async function requireSubject(req: NextRequest): Promise<RequestSubject> {
  const subject = await getSubjectFromRequest(req);
  if (!subject) throw new UnauthorizedError();
  return subject;
}

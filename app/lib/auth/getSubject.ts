/**
 * app/lib/auth/getSubject.ts
 *
 * This is exactly the adapter `lib/permission/index.ts` already documents
 * as the missing wiring step between Phase 13 (auth) and Phase 14
 * (permissions) — see the comment block at the top of that file. It is not
 * specific to Dashboard Menu; every permission-gated API route added by
 * this module (and any future one) should import this rather than
 * duplicating the token-read.
 *
 * ASSUMPTION FLAGGED FOR REVIEW: this assumes `verifyAccessToken` in
 * `@/lib/auth/jwt` returns a payload with userId/isAdmin/isSysAdmin/oaId/
 * oaBrandId claims, per the shape `lib/permission/index.ts` describes. That
 * file was not included in what was provided for this task, so this couldn't
 * be verified against its real signature — only against its documented
 * contract. If the payload shape differs, this is the one file to adjust;
 * nothing in lib/dashboard-menu depends on how the subject was resolved.
 */
// getSubject.ts
import { NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { authConfig } from '@/lib/auth/authConfig';
import type { PermissionSubject } from '@/lib/permission';

export async function getSubjectFromRequest(req: NextRequest): Promise<PermissionSubject | null> {
  const token = req.cookies.get(authConfig.accessTokenCookie)?.value;
  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;

  return {
    userId: Number(payload.sub),
    isAdmin: payload.isAdmin,
    isSysAdmin: payload.isSysAdmin,
    oaId: payload.oaId ?? null,
    oaBrandId: payload.oaBrandId,
  };
}

import { prisma } from '@/lib/prisma';

/**
 * Brand switching support.
 *
 * The access token carries the active brand (`oaBrandId`) and is re-minted from
 * user_mst on every /api/auth/refresh. Without a record of the switch, the brand
 * would silently revert to the user's home brand after 15 minutes. The switch is
 * therefore also kept in a small httpOnly cookie, and /api/auth/refresh re-validates
 * it (resolveBrandAccess) before honouring it — the cookie is never trusted on its own.
 */

/** Cookie value is bound to the user so a leftover cookie can't leak into someone else's session. */
export const formatActiveBrandCookie = (userId: number, brandId: number) => `${userId}:${brandId}`;

export function parseActiveBrandCookie(raw: string | undefined, userId: number): number | null {
  if (!raw) return null;
  const m = /^(\d+):(\d+)$/.exec(raw);
  if (!m || Number(m[1]) !== userId) return null;
  return Number(m[2]);
}

export interface BrandAccessSubject {
  isSysAdmin: boolean;
  isAdmin: boolean;
  oaId: number | null;
  /** The user's home brand (user_mst.OA_BRAND_ID). */
  oaBrandId: number | null;
}

export type BrandAccessResult =
  | { ok: true; brand: { id: number; name: string; oaId: number } }
  | { ok: false; reason: 'not_found' | 'forbidden' };

/**
 * Who may act in which brand.
 *  - system admin: any active brand
 *  - admin: any active brand under their own organisation account (OA_ID)
 *  - employee: only their home brand
 * ASSUMED from the schema/menu code — confirm against the CI switch-brand controller.
 */
export async function resolveBrandAccess(
  subject: BrandAccessSubject,
  brandId: number
): Promise<BrandAccessResult> {
  const brand = await prisma.oa_brands.findFirst({
    where: {
      OA_BRAND_ID: brandId,
      IS_DELETED: 0,
      OR: [{ IS_ACTIVE: true }, { IS_ACTIVE: null }],
    },
    select: { OA_BRAND_ID: true, OA_BRAND_NM: true, OA_ID: true },
  });
  if (!brand) return { ok: false, reason: 'not_found' };

  const allowed =
    subject.isSysAdmin ||
    (subject.isAdmin && subject.oaId !== null && brand.OA_ID === subject.oaId) ||
    brand.OA_BRAND_ID === subject.oaBrandId;

  return allowed
    ? { ok: true, brand: { id: brand.OA_BRAND_ID, name: brand.OA_BRAND_NM, oaId: brand.OA_ID } }
    : { ok: false, reason: 'forbidden' };
}

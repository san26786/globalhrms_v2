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
 *  - admin: any active brand under their own organisation account (OA_ID), and — partner / accountant
 *    organisations — any active brand of a client organisation whose org_accounts.PARTNER_ID is theirs
 *    (CI oa_brands::switchBrandForPartners listed exactly those)
 *  - employee: only their home brand
 * CI's switchBrand itself checked nothing (any logged-in user could switch to any brand id); these
 * are the brands CI's pickers offered.
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

  let allowed =
    subject.isSysAdmin ||
    (subject.isAdmin && subject.oaId !== null && brand.OA_ID === subject.oaId) ||
    brand.OA_BRAND_ID === subject.oaBrandId;

  if (!allowed && subject.isAdmin && subject.oaId !== null) {
    // Partner admin → a client organisation's brand.
    const client = await prisma.org_accounts.findFirst({
      where: { OA_ID: brand.OA_ID, PARTNER_ID: subject.oaId, IS_DELETED: 0 },
      select: { OA_ID: true },
    });
    allowed = client !== null;
  }

  return allowed
    ? { ok: true, brand: { id: brand.OA_BRAND_ID, name: brand.OA_BRAND_NM, oaId: brand.OA_ID } }
    : { ok: false, reason: 'forbidden' };
}

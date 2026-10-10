import { prisma } from '@/lib/prisma';

export async function findHeaderUser(userId: number) {
  return prisma.user_mst.findUnique({
    where: { USER_ID: userId },
    select: {
      USER_ID: true,
      USER_NAME: true,
      FIRST_NAME: true,
      LAST_NAME: true,
      IS_ADMIN: true,
      IS_SYSADMIN: true,
      IS_DELETED: true,
      OA_ID: true,
      OA_BRAND_ID: true,
      // LAST_LOGIN_AT is NOT read here: it is NULL for users who never logged in (Prisma would throw);
      // the header shows the previous login carried in the access token (claim pla).
      NOTIFY_COUNT: true,
    },
  });
}

const ACTIVE_BRAND = {
  IS_DELETED: 0,
  OR: [{ IS_ACTIVE: true }, { IS_ACTIVE: null }],
};

export async function findBrand(oaBrandId: number) {
  return prisma.oa_brands.findUnique({
    where: { OA_BRAND_ID: oaBrandId },
    select: { OA_BRAND_ID: true, OA_BRAND_NM: true, OA_BRAND_LOGO: true },
  });
}

/** CI org_accounts_m::getOrgAccountType(OA_ID) → master code (OATP partner, OATACC accountant, …). */
export async function findOrgAccountTypeCode(oaId: number | null): Promise<string | null> {
  if (oaId === null) return null;
  const org = await prisma.org_accounts.findFirst({ where: { OA_ID: oaId }, select: { OA_ACC_TYPE: true } });
  if (!org?.OA_ACC_TYPE) return null;
  const master = await prisma.independent_mst.findFirst({ where: { MSTR_ID: org.OA_ACC_TYPE }, select: { MSTR_CD: true } });
  return master?.MSTR_CD ?? null;
}

/** System admin: any active brand. Admin: active brands of their own organisation account. */
export async function listSwitchableBrands(
  scope: { isSysAdmin: boolean; oaId: number | null },
  limit: number
) {
  if (!scope.isSysAdmin && scope.oaId === null) return [];
  return prisma.oa_brands.findMany({
    where: { ...ACTIVE_BRAND, ...(scope.isSysAdmin ? {} : { OA_ID: scope.oaId as number }) },
    select: { OA_BRAND_ID: true, OA_BRAND_NM: true },
    orderBy: { OA_BRAND_NM: 'asc' },
    take: limit,
  });
}

/**
 * Latest announcements for the bell dropdown.
 * ASSUMPTION: an announcement addressed to everyone in a brand has USER_ID = 0
 * (the CI form leaves `user` empty). Confirm against how announcement_vw filters.
 */
export async function listRecentAnnouncements(params: {
  userId: number;
  oaBrandId: number | null;
  take: number;
}) {
  return prisma.announcement.findMany({
    where: {
      IS_DELETED: 0,
      USER_ID: { in: [params.userId, 0] },
      ...(params.oaBrandId !== null ? { OA_BRAND_ID: params.oaBrandId } : {}),
    },
    select: {
      ANNOUNCEMENT_ID: true,
      ANNOUNCEMENT_TITLE: true,
      ANNOUNCEMENT_SHORT_DESC: true,
      STATUS_ID: true,
      CREATED_ON: true,
    },
    orderBy: { CREATED_ON: 'desc' },
    take: params.take,
  });
}

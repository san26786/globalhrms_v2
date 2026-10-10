import { prisma } from "@/lib/prisma";

/**
 * user_mst reads/writes for authentication.
 *
 * LAST_LOGIN_AT is declared NOT NULL in the Prisma schema but is NULL for users who never logged
 * in (the migration dropped the constraint and converted MySQL zero-dates to NULL). Reading it
 * through Prisma would throw, so it is read with a raw query.
 */

const LOGIN_SELECT = {
  USER_ID: true,
  USER_NAME: true,
  REG_EMAIL_ID: true,
  PASSWORD: true,
  FIRST_NAME: true,
  LAST_NAME: true,
  USER_STATUS_ID: true,
  IS_ADMIN: true,
  IS_SYSADMIN: true,
  IS_DELETED: true,
  ACTIVATION: true,
  DMN_ID: true,
  OA_ID: true,
  OA_BRAND_ID: true,
  FAILED_LOGIN_ATTEMPTS: true,
  LAST_FAILED_ATTEMPT_ON: true,
  PASSWORD_CHANGED_TIME: true,
  CREATED_ON: true,
  QUESTION_ONE: true,
} as const;

export async function findUserForLogin(usernameOrEmail: string) {
  const value = usernameOrEmail.trim();
  return prisma.user_mst.findFirst({
    where: {
      AND: [
        { OR: [{ USER_NAME: value }, { REG_EMAIL_ID: value }] },
        { OR: [{ IS_DELETED: false }, { IS_DELETED: null }] },
      ],
    },
    orderBy: { USER_ID: "asc" },
    select: LOGIN_SELECT,
  });
}

export type LoginUserRow = NonNullable<Awaited<ReturnType<typeof findUserForLogin>>>;

export async function findLastLoginAt(userId: number): Promise<Date | null> {
  const rows = await prisma.$queryRaw<Array<{ at: Date | null }>>`
    SELECT "LAST_LOGIN_AT" AS at FROM user_mst WHERE "USER_ID" = ${userId} LIMIT 1`;
  const at = rows[0]?.at ?? null;
  // MySQL '0000-00-00 00:00:00' may have been migrated as a 1970/0001 value rather than NULL.
  return at && at.getUTCFullYear() > 1971 ? at : null;
}

export async function findOrgStatusId(oaId: number | null): Promise<number | null> {
  if (!oaId) return null;
  const org = await prisma.org_accounts.findFirst({ where: { OA_ID: oaId }, select: { OA_STATUS_ID: true } });
  return org?.OA_STATUS_ID ?? null;
}

export async function markLoginFailure(userId: number, now: Date) {
  return prisma.user_mst.updateMany({
    where: { USER_ID: userId },
    data: { FAILED_LOGIN_ATTEMPTS: { increment: 1 }, LAST_FAILED_ATTEMPT_ON: now },
  });
}

export async function setUserStatus(userId: number, statusId: number) {
  return prisma.user_mst.updateMany({ where: { USER_ID: userId }, data: { USER_STATUS_ID: statusId } });
}

export async function markLoginSuccess(
  userId: number,
  data: { now: Date; onlineSessions: number; statusId?: number; newPasswordHash?: string },
) {
  return prisma.user_mst.updateMany({
    where: { USER_ID: userId },
    data: {
      LAST_LOGIN_AT: data.now,
      IS_ONLINE: true,
      FAILED_LOGIN_ATTEMPTS: 0,
      SUSPENSION_FAILED_LOGIN_ATTEMPTS: 0,
      LAST_FAILED_ATTEMPT_ON: null,
      CONCURRENT_LOGIN_COUNT: data.onlineSessions,
      ...(data.statusId ? { USER_STATUS_ID: data.statusId } : {}),
      ...(data.newPasswordHash ? { PASSWORD: data.newPasswordHash } : {}),
    },
  });
}

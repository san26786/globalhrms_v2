import { prisma } from "@/lib/prisma";

export async function findUserForLogin(usernameOrEmail: string) {
  const value = usernameOrEmail.trim();

  return prisma.user_mst.findFirst({
    where: {
      AND: [
        {
          OR: [
            { USER_NAME: value },
            { REG_EMAIL_ID: value },
          ],
        },
        {
          OR: [{ IS_DELETED: false }, { IS_DELETED: null }],
        },
      ],
    },
    select: {
      USER_ID: true,
      USER_NAME: true,
      REG_EMAIL_ID: true,
      PASSWORD: true,
      FIRST_NAME: true,
      LAST_NAME: true,
      USER_STATUS_ID: true,
      IS_ADMIN: true,
      IS_SYSADMIN: true,
      IS_ASSIGNABLE: true,
      IS_EDITABLE: true,
      IS_DELETED: true,
      IS_ONLINE: true,
      DMN_ID: true,
      OA_ID: true,
      OA_BRAND_ID: true,
      FAILED_LOGIN_ATTEMPTS: true,
    },
  });
}

export async function markLoginSuccess(userId: number) {
  return prisma.user_mst.update({
    where: { USER_ID: userId },
    data: {
      LAST_LOGIN_AT: new Date(),
      IS_ONLINE: true,
      FAILED_LOGIN_ATTEMPTS: 0,
      LAST_FAILED_ATTEMPT_ON: null,
    },
  });
}

export async function markLoginFailure(userId: number) {
  return prisma.user_mst.update({
    where: { USER_ID: userId },
    data: {
      FAILED_LOGIN_ATTEMPTS: { increment: 1 },
      LAST_FAILED_ATTEMPT_ON: new Date(),
    },
  });
}

export async function markLogout(userId: number) {
  return prisma.user_mst.update({
    where: { USER_ID: userId },
    data: { IS_ONLINE: false },
  });
}
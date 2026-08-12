import { prisma } from "@/lib/prisma";

export async function hasPermission(
  userId: string,
  action: string,
  module: string
): Promise<void> {
  const permission = await (prisma as any).user_permission.findFirst({
    where: {
      USER_ID: Number(userId),
      MODULE_NAME: module,
      ACTION_NAME: action,
      IS_ACTIVE: true,
    },
  });

  if (!permission) {
    throw new Error("Access denied. You do not have permission.");
  }
}
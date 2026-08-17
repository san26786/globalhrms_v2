import { prisma } from "@/lib/prisma";

export async function hasPermission(
  userId: string,
  permissionRefId: number,
  action: "READ" | "INSERT" | "MODIFY" | "DELETE" | "PRINT" | "EXECUTE"
): Promise<boolean> {
  const permission = await prisma.permission_dtl.findFirst({
    where: {
      USER_ID: Number(userId),
      PERMISSIONS_REF_ID: permissionRefId,
      PERMISSION_ENABLED: 1,
      IS_DELETED: 0,
    },
  });

  if (!permission) {
    return false;
  }

  switch (action) {
    case "READ":
      return permission.PERMISSION_READ_ONLY === 1;

    case "INSERT":
      return permission.PERMISSION_INSERT === 1;

    case "MODIFY":
      return permission.PERMISSION_MODIFY === 1;

    case "DELETE":
      return permission.PERMISSION_DELETE === 1;

    case "PRINT":
      return permission.PERMISSION_PRINT === 1;

    case "EXECUTE":
      return permission.PERMISSION_EXECUTE === 1;

    default:
      return false;
  }
}
/**
 * app/lib/permission/permissionQueries.ts
 *
 * Raw Prisma queries only — no business logic, no caching, no decisions.
 */
import { prisma } from '@/lib/prisma';
import { PermissionRefType } from '@/lib/permission/permissionTypes';
import type { PermissionDtlRow } from '@/lib/permission/permissionTypes';

const PERMISSION_DTL_SELECT = {
  PERMISSIONS_DTL_ID: true,
  PERMISSIONS_CLASS_ID: true,
  PERMISSIONS_REF_TYPE_ID: true,
  PERMISSIONS_REF_ID: true,
  PERMISSIONS_ID: true,
  PERMISSION_ENABLED: true,
  PERMISSION_READ_ONLY: true,
  PERMISSION_MODIFY: true,
  PERMISSION_DELETE: true,
  PERMISSION_PRINT: true,
  PERMISSION_EXECUTE: true,
  PERMISSION_INSERT: true,
  IS_DELETED: true,
  OA_ID: true,
  OA_BRAND_ID: true,
} as const;

/** FUNCTION (1614) grants of one permission class in one brand, optionally for given resources. */
export async function queryFunctionGrants(
  permissionsClassId: number,
  oaBrandId: number,
  resourceIds?: number[],
): Promise<PermissionDtlRow[]> {
  if (resourceIds && resourceIds.length === 0) return [];
  return prisma.permission_dtl.findMany({
    where: {
      PERMISSIONS_REF_TYPE_ID: PermissionRefType.FUNCTION,
      PERMISSIONS_CLASS_ID: permissionsClassId,
      OA_BRAND_ID: oaBrandId,
      IS_DELETED: 0,
      ...(resourceIds ? { PERMISSIONS_REF_ID: { in: resourceIds } } : {}),
    },
    select: PERMISSION_DTL_SELECT,
  });
}

/**
 * relationship_dtl ids (== menu_config.MENU_ID) of the menu entries whose URL is the given
 * CI-style path or starts with it — CI's has_permission_to_access used `URL LIKE 'folder/class%'`.
 */
export async function queryMenuResourceIdsByUrl(urlPrefix: string): Promise<number[]> {
  const rows = await prisma.menu_config.findMany({
    where: { URL: { startsWith: urlPrefix } },
    select: { MENU_ID: true, URL: true },
  });
  return [
    ...new Set(
      rows
        .filter((r) => r.URL === urlPrefix || /^[/?]/.test(r.URL.slice(urlPrefix.length)))
        .map((r) => r.MENU_ID),
    ),
  ];
}

/** Basic user lookup for the fields the permission engine needs. */
export async function queryUserForPermissionCheck(userId: number) {
  return prisma.user_mst.findFirst({
    where: { USER_ID: userId },
    select: {
      USER_ID: true,
      IS_ADMIN: true,
      IS_SYSADMIN: true,
      OA_ID: true,
      OA_BRAND_ID: true,
      IS_DELETED: true,
    },
  });
}

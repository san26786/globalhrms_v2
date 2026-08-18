/**
 * app/lib/permission/permissionQueries.ts
 *
 * Raw Prisma queries only — no business logic, no caching, no decisions.
 * Keeping this file "dumb" makes it trivial to unit test the repository/service
 * above it with a mocked query module.
 */
import { prisma } from "@/lib/prisma";
import { PermissionRefType } from "@/lib/permission/permissionTypes";
import type { PermissionDtlRow } from "@/lib/permission/permissionTypes";

const ACTIVE_PERMISSION_DTL_SELECT = {
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

/**
 * All active (non-deleted) role ids assigned to a user, via user_role.
 * Mirrors legacy `User_Role_m::getUserMasterRoleId`.
 */
export async function queryActiveRoleIdsForUser(userId: number): Promise<number[]> {
  const rows = await prisma.user_role.findMany({
    where: { USER_ID: userId, IS_DELETED: 0 },
    select: { ROLE_ID: true },
  });
  return rows.map((r) => r.ROLE_ID);
}

/**
 * permission_dtl rows granted to a set of ref ids (roles, users, or groups) for one ref type.
 * Optionally narrowed to a single resource (PERMISSIONS_ID).
 */
export async function queryPermissionDtlByRefs(
  refType: PermissionRefType,
  refIds: number[],
  resourceId?: number,
): Promise<PermissionDtlRow[]> {
  if (refIds.length === 0) return [];

  return prisma.permission_dtl.findMany({
    where: {
      PERMISSIONS_REF_TYPE_ID: refType,
      PERMISSIONS_REF_ID: { in: refIds },
      IS_DELETED: 0,
      ...(resourceId !== undefined ? { PERMISSIONS_ID: resourceId } : {}),
    },
    select: ACTIVE_PERMISSION_DTL_SELECT,
  });
}

/**
 * All permission_dtl rows granted directly to a single user (PERMISSIONS_REF_TYPE_ID = USER),
 * across all resources. Used to build the "effective permission set" for a full page/menu load.
 */
export async function queryPermissionDtlForUserDirect(
  userId: number,
): Promise<PermissionDtlRow[]> {
  return prisma.permission_dtl.findMany({
    where: {
      PERMISSIONS_REF_TYPE_ID: PermissionRefType.USER,
      PERMISSIONS_REF_ID: userId,
      IS_DELETED: 0,
    },
    select: ACTIVE_PERMISSION_DTL_SELECT,
  });
}

/**
 * All permission_dtl rows granted to any of the given role ids, across all resources.
 */
export async function queryPermissionDtlForRoles(
  roleIds: number[],
): Promise<PermissionDtlRow[]> {
  return queryPermissionDtlByRefs(PermissionRefType.ROLE, roleIds);
}

/**
 * Single permission_dtl row lookup by its own PK — used by permissionValidation / admin screens
 * (parity with legacy `Permission_dtl_m::delete`, `updatePermissions`, etc.).
 */
export async function queryPermissionDtlById(id: number): Promise<PermissionDtlRow | null> {
  return prisma.permission_dtl.findUnique({
    where: { PERMISSIONS_DTL_ID: id },
    select: ACTIVE_PERMISSION_DTL_SELECT,
  });
}

/**
 * Basic user lookup for the fields the permission engine needs (admin bypass, tenant scope).
 * Kept here (rather than duplicated from a user repository) so this module has no cross-domain
 * dependency beyond Prisma itself.
 */
export async function queryUserForPermissionCheck(userId: number) {
  return prisma.user_mst.findUnique({
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

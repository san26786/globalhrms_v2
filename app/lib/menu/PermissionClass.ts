/**
 * Phase 15 — Dynamic Sidebar/Menu
 *
 * Ports login.php's get_permission_class($oa_brand_id, $user_id).
 *
 * In the legacy app this ran once at login and the result was cached in
 * session ('permissions_class_id', 'role_id'). Here we recompute it on
 * demand (called from app/api/menu/route.ts). If this route gets hot,
 * cache the result on the session/JWT at login time instead of calling
 * this per request — the logic itself doesn't need to change either way.
 *
 * permission_dtl doubles as two different tables depending on
 * PERMISSIONS_REF_TYPE_ID:
 *   65 -> USER  -> CLASS   (which permission class this user is directly assigned)
 *   66 -> ROLE  -> CLASS   (which permission class a role maps to)
 * (1614, used in menuService.ts, is a third meaning: MENU -> CLASS.)
 */

import { prisma } from '@/lib/prisma';

const REF_TYPE_USER_TO_CLASS = 65;
const REF_TYPE_ROLE_TO_CLASS = 66;

export interface ResolvedPermissionClass {
  permissionsClassId: number | null;
  roleId: number | null;
}

export async function resolvePermissionsClassId(
  oaBrandId: number,
  userId: number
): Promise<ResolvedPermissionClass> {
  const userClassRows = await prisma.permission_dtl.findMany({
    where: {
      PERMISSIONS_REF_TYPE_ID: REF_TYPE_USER_TO_CLASS,
      PERMISSIONS_REF_ID: userId,
      OA_BRAND_ID: oaBrandId,
    },
    select: { PERMISSIONS_CLASS_ID: true },
    distinct: ['PERMISSIONS_CLASS_ID'],
  });

  // 0 matches — PHP: $permissions_class_id = null;
  if (userClassRows.length === 0) {
    return { permissionsClassId: null, roleId: null };
  }

  const permissionsClassIds = userClassRows.map((r) => r.PERMISSIONS_CLASS_ID);

  // 1 match — PHP just uses it, but still resolves role_id for session/downstream use.
  if (permissionsClassIds.length === 1) {
    const roleId = await resolveRoleIdForClasses(oaBrandId, permissionsClassIds);
    return { permissionsClassId: permissionsClassIds[0], roleId };
  }

  // >1 match — PHP breaks the tie via the highest-authority role among the
  // roles mapped to these classes, then re-resolves a single class from
  // that winning role.
  const roleId = await resolveRoleIdForClasses(oaBrandId, permissionsClassIds);

  if (roleId !== null) {
    const finalClass = await prisma.permission_dtl.findFirst({
      where: {
        PERMISSIONS_REF_TYPE_ID: REF_TYPE_ROLE_TO_CLASS,
        PERMISSIONS_REF_ID: roleId,
        OA_BRAND_ID: oaBrandId,
      },
      select: { PERMISSIONS_CLASS_ID: true },
    });
    return {
      permissionsClassId: finalClass?.PERMISSIONS_CLASS_ID ?? permissionsClassIds[0],
      roleId,
    };
  }

  // PHP fallback: reset($permissions_class_ids) — just take the first one.
  return { permissionsClassId: permissionsClassIds[0], roleId: null };
}

/**
 * Given a set of permission classes, find every role mapped to any of them
 * (PERMISSIONS_REF_TYPE_ID = 66), then pick the role with the lowest
 * authority_level.VALUE (matches PHP's `ORDER BY al.VALUE ASC LIMIT 1`,
 * which sorts VALUE as a string — replicated here with a string compare
 * since authority_level.VALUE is stored as varchar, not int, in this schema).
 */
async function resolveRoleIdForClasses(
  oaBrandId: number,
  permissionsClassIds: number[]
): Promise<number | null> {
  const roleLinks = await prisma.permission_dtl.findMany({
    where: {
      PERMISSIONS_REF_TYPE_ID: REF_TYPE_ROLE_TO_CLASS,
      OA_BRAND_ID: oaBrandId,
      PERMISSIONS_CLASS_ID: { in: permissionsClassIds },
    },
    select: { PERMISSIONS_REF_ID: true },
  });

  const roleIds = [
    ...new Set(
      roleLinks
        .map((r) => r.PERMISSIONS_REF_ID)
        .filter((id): id is number => id !== null && id !== undefined)
    ),
  ];

  if (roleIds.length === 0) return null;
  if (roleIds.length === 1) return roleIds[0];

  const roles = await prisma.role_mst.findMany({
    where: { ROLE_ID: { in: roleIds } },
    select: { ROLE_ID: true, AUTHORITY_LEVEL: true },
  });

  const authorityLevelIds = [
    ...new Set(
      roles
        .map((r) => r.AUTHORITY_LEVEL)
        .filter((id): id is number => id !== null && id !== undefined)
    ),
  ];

  const authorityLevels = authorityLevelIds.length
    ? await prisma.authority_level.findMany({
        where: { AUTHORITY_LEVEL_ID: { in: authorityLevelIds } },
        select: { AUTHORITY_LEVEL_ID: true, VALUE: true },
      })
    : [];

  const valueByLevelId = new Map(
    authorityLevels.map((a) => [a.AUTHORITY_LEVEL_ID, a.VALUE ?? ''])
  );

  const ranked = roles
    .filter((r) => r.AUTHORITY_LEVEL !== null && r.AUTHORITY_LEVEL !== undefined)
    .map((r) => ({
      roleId: r.ROLE_ID,
      sortValue: valueByLevelId.get(r.AUTHORITY_LEVEL as number) ?? '',
    }))
    .sort((a, b) => (a.sortValue < b.sortValue ? -1 : a.sortValue > b.sortValue ? 1 : 0));

  return ranked.length ? ranked[0].roleId : roleIds[0];
}
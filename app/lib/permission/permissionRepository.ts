/**
 * app/lib/permission/permissionRepository.ts
 *
 * Domain-facing data access. Talks only to permissionQueries.ts (never to Prisma directly),
 * so the service layer never has to know about `findMany`/`select` shapes.
 */
import {
  queryActiveRoleIdsForUser,
  queryPermissionDtlByRefs,
  queryPermissionDtlForRoles,
  queryPermissionDtlForUserDirect,
  queryPermissionDtlById,
  queryUserForPermissionCheck,
} from './permissionQueries';
import { PermissionRefType } from './permissionTypes';
import type { PermissionDtlRow, PermissionSubject } from './permissionTypes';

export class PermissionRepository {
  /** Active role ids for a user (via user_role, IS_DELETED = 0). */
  async getActiveRoleIds(userId: number): Promise<number[]> {
    return queryActiveRoleIdsForUser(userId);
  }

  /**
   * Every permission_dtl row that could possibly apply to this user for the given resource:
   * role-based grants (via their active roles) + any direct per-user override rows.
   * Pass `resourceId` to narrow to one resource; omit it to load the user's full permission set
   * (e.g. for rendering a menu/nav where you need every resource at once).
   */
  async getApplicableRows(userId: number, resourceId?: number): Promise<PermissionDtlRow[]> {
    const roleIds = await this.getActiveRoleIds(userId);

    const [roleRows, userRows] = await Promise.all([
      queryPermissionDtlByRefs(PermissionRefType.ROLE, roleIds, resourceId),
      queryPermissionDtlByRefs(PermissionRefType.USER, [userId], resourceId),
    ]);

    return [...roleRows, ...userRows];
  }

  /** All rows for a user's full set of active roles, unfiltered by resource. */
  async getAllRoleGrantedRows(userId: number): Promise<PermissionDtlRow[]> {
    const roleIds = await this.getActiveRoleIds(userId);
    return queryPermissionDtlForRoles(roleIds);
  }

  /** All rows granted directly to the user (per-user overrides), unfiltered by resource. */
  async getAllUserGrantedRows(userId: number): Promise<PermissionDtlRow[]> {
    return queryPermissionDtlForUserDirect(userId);
  }

  async getRowById(id: number): Promise<PermissionDtlRow | null> {
    return queryPermissionDtlById(id);
  }

  /**
   * Builds a PermissionSubject (admin flags + tenant scope) for a userId. This is the one place
   * that reaches into user_mst on behalf of the permission engine — Phase 13 auth should already
   * have this data on the session/JWT payload, in which case prefer calling
   * `permissionEngine` with a subject you already built rather than round-tripping to the DB.
   */
  async getSubject(userId: number): Promise<PermissionSubject | null> {
    const user = await queryUserForPermissionCheck(userId);
    if (!user || user.IS_DELETED) return null;

    return {
      userId: user.USER_ID,
      isAdmin: user.IS_ADMIN,
      isSysAdmin: user.IS_SYSADMIN,
      oaId: user.OA_ID,
      oaBrandId: user.OA_BRAND_ID,
    };
  }
}

export const permissionRepository = new PermissionRepository();

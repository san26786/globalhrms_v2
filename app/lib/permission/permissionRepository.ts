/**
 * app/lib/permission/permissionRepository.ts
 *
 * Domain-facing data access for authorization. Talks to permissionQueries.ts and to the
 * permission-class resolver (lib/menu/PermissionClass.ts — the port of CI get_permission_class).
 */
import { resolvePermissionsClassId } from '@/lib/menu/PermissionClass';
import {
  queryFunctionGrants,
  queryMenuResourceIdsByUrl,
  queryUserForPermissionCheck,
} from './permissionQueries';
import type { PermissionDtlRow, PermissionSubject } from './permissionTypes';

/**
 * The permission class is resolved once per subject object. The subject is built fresh for each
 * request (lib/auth/getSubject.ts), so this is a per-request cache that cannot go stale.
 */
const classCache = new WeakMap<PermissionSubject, Promise<number | null>>();

export class PermissionRepository {
  async getPermissionsClassId(subject: PermissionSubject): Promise<number | null> {
    if (!subject.oaBrandId) return null;
    let pending = classCache.get(subject);
    if (!pending) {
      pending = resolvePermissionsClassId(subject.oaBrandId, subject.userId).then(
        (r) => r.permissionsClassId,
      );
      classCache.set(subject, pending);
    }
    return pending;
  }

  async getFunctionGrants(
    permissionsClassId: number,
    oaBrandId: number,
    resourceIds?: number[],
  ): Promise<PermissionDtlRow[]> {
    return queryFunctionGrants(permissionsClassId, oaBrandId, resourceIds);
  }

  async getMenuResourceIds(urlPrefix: string): Promise<number[]> {
    return queryMenuResourceIdsByUrl(urlPrefix.replace(/^\/+/, ''));
  }

  /** Builds a PermissionSubject from the database (for call sites that only have a userId). */
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

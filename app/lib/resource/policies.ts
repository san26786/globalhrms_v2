import { PermissionAction, permissionEngine } from '@/lib/permission';
import type { AccessPolicy, ResourceAction } from './types';

const ACTION_FLAG: Record<ResourceAction, PermissionAction> = {
  list: PermissionAction.ENABLED,
  read: PermissionAction.ENABLED,
  create: PermissionAction.INSERT,
  update: PermissionAction.MODIFY,
  delete: PermissionAction.DELETE,
};

/** Only the system administrator (CI is_admin == 2). */
export const sysAdminOnly: AccessPolicy = {
  async check(subject) {
    return subject.adminLevel === 2;
  },
};

/** Org/brand admin or system admin (CI is_admin != 0). */
export const adminOnly: AccessPolicy = {
  async check(subject) {
    return subject.adminLevel >= 1;
  },
};

/** Any logged-in user (reads), admins for writes. */
export const readAllWriteAdmin: AccessPolicy = {
  async check(subject, action) {
    return action === 'list' || action === 'read' ? true : subject.adminLevel >= 1;
  },
};

/** Read-only data every logged-in user may see (row scoping still applies); never writable. */
export const readOnlyForAll: AccessPolicy = {
  async check(_subject, action) {
    return action === 'list' || action === 'read';
  },
};

/**
 * Menu-permission policy — CI has_permission_to_access() + has_*_permission():
 * the caller's permission class must have the FUNCTION grant (ENABLED / INSERT / MODIFY / DELETE)
 * on the menu entry of `menuUrl` (CI-style path, e.g. 'systmInfoMgr/systm_setting').
 * If no menu entry exists for the URL the `fallback` policy decides (default: admins only).
 */
export function menuPolicy(menuUrl: string, fallback: AccessPolicy = adminOnly): AccessPolicy {
  return {
    async check(subject, action) {
      const result = await permissionEngine.evaluateMenu(subject, menuUrl, ACTION_FLAG[action]);
      if (result.reason === 'UNKNOWN_RESOURCE') return fallback.check(subject, action);
      return result.allowed;
    },
  };
}

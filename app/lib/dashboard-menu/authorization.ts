/**
 * app/lib/dashboard-menu/authorization.ts
 *
 * Server-side gate for the whole Dashboard Menu admin screen. The supplied
 * CI controller has no explicit permission_dtl check of its own (unlike the
 * sidebar filtering in Generateall_m::getChildMenu) — it only sat behind
 * whatever generic authenticated-admin session CI's front controller
 * enforced. To avoid inventing a permission row that doesn't exist in your
 * seed data, this defaults to "must be IS_ADMIN or IS_SYSADMIN" (the same
 * bar the legacy screen implicitly required), while still routing through
 * permissionEngine so that setting DASHBOARD_MENU_RESOURCE_ID later is a
 * one-line change with no call-site edits.
 */
import { permissionEngine, PermissionAction, type PermissionSubject } from '@/lib/permission';
import { DASHBOARD_MENU_RESOURCE_ID } from './constants';

export class DashboardMenuAccessDeniedError extends Error {
  constructor() {
    super('You do not have permission to manage Dashboard Menu.');
    this.name = 'DashboardMenuAccessDeniedError';
  }
}

export async function assertCanManageDashboardMenu(subject: PermissionSubject): Promise<void> {
  if (subject.isAdmin || subject.isSysAdmin) return;

  if (DASHBOARD_MENU_RESOURCE_ID != null) {
    const allowed = await permissionEngine.can(subject, DASHBOARD_MENU_RESOURCE_ID, PermissionAction.ENABLED);
    if (allowed) return;
  }

  throw new DashboardMenuAccessDeniedError();
}

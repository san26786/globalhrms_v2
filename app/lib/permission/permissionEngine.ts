/**
 * app/lib/permission/permissionEngine.ts
 *
 * The authorization entry point for API routes and services.
 *
 * Decision (parity with CI):
 *   - system admin (IS_SYSADMIN / is_admin == 2) is never restricted — CI's menu query and its
 *     (disabled) URL check both bypass sysadmin.
 *   - everyone else, INCLUDING org/brand admins, is decided by their permission class's FUNCTION
 *     grants (permission_dtl ref type 1614) in the active brand — exactly the rows that decide
 *     which menu items CI shows them.
 * A resource is a relationship_dtl.REL_DET_ID; `canAccessMenu` resolves it from a CI-style menu
 * URL (e.g. 'systmInfoMgr/systm_setting'), reproducing CI's has_permission_to_access().
 */
import { permissionRepository } from './permissionRepository';
import { permissionService } from './permissionService';
import { PermissionAction, PermissionDeniedError } from './permissionTypes';
import type {
  EffectivePermission,
  PermissionCheckResult,
  PermissionSubject,
} from './permissionTypes';

function decide(permission: EffectivePermission, hasClass: boolean, action: PermissionAction): PermissionCheckResult {
  if (!hasClass) return { allowed: false, reason: 'NO_PERMISSION_CLASS' };
  if (!permission.enabled) {
    return { allowed: false, reason: permission.sources.length ? 'DISABLED' : 'NO_MATCHING_ROW' };
  }
  const flags: Record<PermissionAction, boolean> = {
    [PermissionAction.ENABLED]: permission.enabled,
    [PermissionAction.READ_ONLY]: permission.readOnly,
    [PermissionAction.MODIFY]: permission.modify,
    [PermissionAction.DELETE]: permission.delete,
    [PermissionAction.INSERT]: permission.insert,
    [PermissionAction.PRINT]: permission.print,
    [PermissionAction.EXECUTE]: permission.execute,
  };
  return flags[action] ? { allowed: true, reason: 'GRANTED' } : { allowed: false, reason: 'ACTION_NOT_GRANTED' };
}

async function evaluateResources(
  subject: PermissionSubject,
  resourceIds: number[],
  action: PermissionAction,
): Promise<PermissionCheckResult> {
  if (subject.isSysAdmin) return { allowed: true, reason: 'SYSADMIN_BYPASS' };
  if (resourceIds.length === 0) return { allowed: false, reason: 'UNKNOWN_RESOURCE' };
  const { permission, hasClass } = await permissionService.getEffectivePermission(subject, resourceIds);
  return decide(permission, hasClass, action);
}

async function evaluateMenu(
  subject: PermissionSubject,
  menuUrl: string,
  action: PermissionAction,
): Promise<PermissionCheckResult> {
  if (subject.isSysAdmin) return { allowed: true, reason: 'SYSADMIN_BYPASS' };
  const resourceIds = await permissionRepository.getMenuResourceIds(menuUrl);
  return evaluateResources(subject, resourceIds, action);
}

export const permissionEngine = {
  /** Boolean check on one relationship_dtl resource. */
  async can(
    subject: PermissionSubject,
    resourceId: number,
    action: PermissionAction = PermissionAction.ENABLED,
  ): Promise<boolean> {
    return (await evaluateResources(subject, [resourceId], action)).allowed;
  },

  /** Throws PermissionDeniedError if not allowed. */
  async assert(
    subject: PermissionSubject,
    resourceId: number,
    action: PermissionAction = PermissionAction.ENABLED,
  ): Promise<void> {
    const result = await evaluateResources(subject, [resourceId], action);
    if (!result.allowed) throw new PermissionDeniedError(resourceId, action, result.reason);
  },

  async evaluate(
    subject: PermissionSubject,
    resourceId: number,
    action: PermissionAction = PermissionAction.ENABLED,
  ): Promise<PermissionCheckResult> {
    return evaluateResources(subject, [resourceId], action);
  },

  /** CI has_permission_to_access(): decision for the menu entries of a CI-style URL. */
  async evaluateMenu(
    subject: PermissionSubject,
    menuUrl: string,
    action: PermissionAction = PermissionAction.ENABLED,
  ): Promise<PermissionCheckResult> {
    return evaluateMenu(subject, menuUrl, action);
  },

  async canAccessMenu(
    subject: PermissionSubject,
    menuUrl: string,
    action: PermissionAction = PermissionAction.ENABLED,
  ): Promise<boolean> {
    return (await evaluateMenu(subject, menuUrl, action)).allowed;
  },

  /** Every FUNCTION grant of the subject, keyed by REL_DET_ID — for menus and button states. */
  async getMenu(subject: PermissionSubject): Promise<Map<number, EffectivePermission>> {
    return permissionService.getEffectivePermissionMap(subject);
  },
};

/**
 * Route helper: require a FUNCTION permission before the handler runs.
 * New routes should prefer `withApi` + a resource policy (lib/resource); this remains for
 * handlers that authorise against a known REL_DET_ID.
 */
export function withPermission<TContext = unknown>(
  resourceId: number,
  action: PermissionAction,
  getSubject: (req: Request) => Promise<PermissionSubject | null>,
  handler: (req: Request, ctx: TContext & { subject: PermissionSubject }) => Promise<Response>,
) {
  return async (req: Request, ctx: TContext): Promise<Response> => {
    const subject = await getSubject(req);
    if (!subject) {
      return Response.json({ success: false, message: 'You are not logged in.', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const result = await evaluateResources(subject, [resourceId], action);
    if (!result.allowed) {
      return Response.json(
        { success: false, message: 'You do not have permission to perform this action.', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }
    return handler(req, { ...ctx, subject });
  };
}

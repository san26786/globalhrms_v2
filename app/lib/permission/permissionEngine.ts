/**
 * app/lib/permission/permissionEngine.ts
 *
 * The main authorization entry point — this is what API routes, server components, and
 * button-level checks should import. Everything else in this folder is an implementation detail.
 *
 *   Phase 13 Authentication → Logged-in User → Role/Role IDs
 *                                                     │
 *                                                     ▼
 *                                          permissionEngine.can(...)
 *                                                     │
 *                                                     ▼
 *                                     API / Page / Button Authorization
 */
import { permissionRepository } from './permissionRepository';
import { permissionService } from './permissionService';
import {
  PermissionAction,
  PermissionDeniedError,
} from './permissionTypes';
import type {
  EffectivePermission,
  PermissionCheckResult,
  PermissionSubject,
} from './permissionTypes';

/**
 * Core decision function. Admins (IS_ADMIN / IS_SYSADMIN) always pass, matching the legacy
 * `session->userdata('is_admin')` bypass used throughout the CI codebase.
 */
async function evaluate(
  subject: PermissionSubject,
  resourceId: number,
  action: PermissionAction,
): Promise<PermissionCheckResult> {
  if (subject.isAdmin || subject.isSysAdmin) {
    return { allowed: true, reason: 'ADMIN_BYPASS' };
  }

  const effective = await permissionService.getEffectivePermission(subject.userId, resourceId);

  if (!effective.enabled) {
    return { allowed: false, reason: effective.sources.length ? 'DISABLED' : 'NO_MATCHING_ROW' };
  }

  if (action === PermissionAction.ENABLED) {
    return { allowed: true, reason: 'GRANTED' };
  }

  const actionMap: Record<PermissionAction, boolean> = {
    [PermissionAction.ENABLED]: effective.enabled,
    [PermissionAction.READ_ONLY]: effective.readOnly,
    [PermissionAction.MODIFY]: effective.modify,
    [PermissionAction.DELETE]: effective.delete,
    [PermissionAction.INSERT]: effective.insert,
    [PermissionAction.PRINT]: effective.print,
    [PermissionAction.EXECUTE]: effective.execute,
  };

  return actionMap[action]
    ? { allowed: true, reason: 'GRANTED' }
    : { allowed: false, reason: 'ACTION_NOT_GRANTED' };
}

export const permissionEngine = {
  /**
   * Boolean check — use for `if (await permissionEngine.can(subject, resourceId, action))`.
   */
  async can(
    subject: PermissionSubject,
    resourceId: number,
    action: PermissionAction = PermissionAction.ENABLED,
  ): Promise<boolean> {
    const result = await evaluate(subject, resourceId, action);
    return result.allowed;
  },

  /**
   * Same as `can`, but resolves the subject from a userId first. Prefer `can()` with a subject
   * you already have (e.g. from the JWT payload / session) to avoid an extra DB round trip —
   * this convenience method exists for call sites (e.g. server actions) that only have a userId.
   */
  async canByUserId(
    userId: number,
    resourceId: number,
    action: PermissionAction = PermissionAction.ENABLED,
  ): Promise<boolean> {
    const subject = await permissionRepository.getSubject(userId);
    if (!subject) return false;
    return this.can(subject, resourceId, action);
  },

  /**
   * Throws PermissionDeniedError if not allowed. Use in API routes / server actions where a
   * denial should hard-stop execution.
   */
  async assert(
    subject: PermissionSubject,
    resourceId: number,
    action: PermissionAction = PermissionAction.ENABLED,
  ): Promise<void> {
    const result = await evaluate(subject, resourceId, action);
    if (!result.allowed) {
      throw new PermissionDeniedError(resourceId, action, result.reason);
    }
  },

  /** Full detail (allowed + reason) — use when you need to log/report why access was denied. */
  async evaluate(
    subject: PermissionSubject,
    resourceId: number,
    action: PermissionAction = PermissionAction.ENABLED,
  ): Promise<PermissionCheckResult> {
    return evaluate(subject, resourceId, action);
  },

  /** Full effective-permission set for a user — for rendering menus/pages/buttons in one shot. */
  async getMenu(userId: number): Promise<Map<number, EffectivePermission>> {
    return permissionService.getEffectivePermissionMap(userId);
  },

  /** Effective permission for a single resource — powers per-button enable/disable state. */
  async getResourcePermission(userId: number, resourceId: number): Promise<EffectivePermission> {
    return permissionService.getEffectivePermission(userId, resourceId);
  },
};

/**
 * API route helper. Wrap a Next.js route handler to require a permission before it runs.
 *
 *   // app/api/employees/route.ts
 *   export const DELETE = withPermission(EMPLOYEE_RESOURCE_ID, PermissionAction.DELETE,
 *     async (req, { subject }) => {
 *       // subject.userId is guaranteed authorized for DELETE on EMPLOYEE_RESOURCE_ID here
 *       return NextResponse.json({ ok: true });
 *     }
 *   );
 *
 * `getSubject` must be supplied by your Phase 13 auth layer (e.g. reading the verified JWT
 * payload set by middleware.ts) — this file intentionally has no dependency on jwt.ts so the two
 * phases stay decoupled. See index.ts for the recommended wiring.
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
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await evaluate(subject, resourceId, action);
    if (!result.allowed) {
      return Response.json(
        { error: 'Forbidden', reason: result.reason },
        { status: 403 },
      );
    }

    return handler(req, { ...ctx, subject });
  };
}

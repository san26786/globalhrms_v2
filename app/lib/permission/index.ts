/**
 * app/lib/permission/index.ts
 *
 * Barrel export for the permission module.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WIRING INTO PHASE 13 (do this once, then delete this comment block)
 * ─────────────────────────────────────────────────────────────────────────
 * `permissionEngine` deliberately has zero import of `app/lib/auth/*`, so Phase 13 and Phase 14
 * stay decoupled and independently testable. You need one small adapter to connect them.
 *
 * 1) In `app/lib/auth/jwt.ts`, your verified access-token payload should already carry enough
 *    to build a PermissionSubject without hitting the DB (userId, isAdmin/isSysAdmin, oaId,
 *    oaBrandId). If it doesn't yet, add those claims when you sign the access token in
 *    `auth-service.ts` — it avoids an extra query on every authorized request.
 *
 * 2) Add a small helper, e.g. `app/lib/auth/getSubject.ts`:
 *
 *      import { verifyAccessToken } from './jwt';
 *      import type { PermissionSubject } from '@/app/lib/permission';
 *
 *      export async function getSubjectFromRequest(req: Request): Promise<PermissionSubject | null> {
 *        const token = req.headers.get('authorization')?.replace('Bearer ', '');
 *        if (!token) return null;
 *        const payload = await verifyAccessToken(token); // however Phase 13 does this
 *        if (!payload) return null;
 *        return {
 *          userId: payload.userId,
 *          isAdmin: payload.isAdmin,
 *          isSysAdmin: payload.isSysAdmin,
 *          oaId: payload.oaId,
 *          oaBrandId: payload.oaBrandId,
 *        };
 *      }
 *
 *    If the JWT payload doesn't carry those flags, fall back to
 *    `permissionRepository.getSubject(payload.userId)` inside this helper instead — it costs one
 *    extra `user_mst` lookup per request but requires no token changes.
 *
 * 3) Use it with `withPermission`:
 *
 *      import { withPermission, PermissionAction } from '@/app/lib/permission';
 *      import { getSubjectFromRequest } from '@/app/lib/auth/getSubject';
 *
 *      export const DELETE = withPermission(
 *        EMPLOYEE_RESOURCE_ID,
 *        PermissionAction.DELETE,
 *        getSubjectFromRequest,
 *        async (req, { subject }) => Response.json({ ok: true }),
 *      );
 *
 * 4) Before any of this is trustworthy, confirm the real `PERMISSIONS_REF_TYPE_ID` values in
 *    `permissionTypes.ts` (`PermissionRefType`) against your seed data — they're placeholders
 *    reverse-engineered from the legacy PHP, not read from your actual lookup table.
 * ─────────────────────────────────────────────────────────────────────────
 */

export * from './permissionTypes';
export { permissionRepository, PermissionRepository } from './permissionRepository';
export { permissionService, PermissionService } from './permissionService';
export { permissionEngine, withPermission } from './permissionEngine';
export * from './permissionValidation';

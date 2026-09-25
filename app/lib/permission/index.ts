/**
 * app/lib/permission/index.ts — barrel for the authorization module.
 *
 * Entry point: `permissionEngine` (decision rules documented in permissionEngine.ts).
 * The subject comes from `getSubjectFromRequest` / `requireSubject` (lib/auth/getSubject.ts).
 */

export * from './permissionTypes';
export { permissionRepository, PermissionRepository } from './permissionRepository';
export { permissionService, PermissionService } from './permissionService';
export { permissionEngine, withPermission } from './permissionEngine';
export * from './permissionValidation';

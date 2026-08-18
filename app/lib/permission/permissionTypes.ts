/**
 * app/lib/permission/permissionTypes.ts
 *
 * Shared types/enums for the authorization layer built on top of `permission_dtl`.
 *
 * SCHEMA RECAP (from prisma/schema.prisma):
 *   permission_dtl {
 *     PERMISSIONS_DTL_ID       PK
 *     PERMISSIONS_CLASS_ID     groups a set of dtl rows into a named "permission class" / profile
 *     PERMISSIONS_REF_TYPE_ID  WHO the grant applies to: ROLE | USER | GROUP (see PermissionRefType)
 *     PERMISSIONS_REF_ID       the id of that role/user/group
 *     PERMISSIONS_ID           WHAT is granted — a resource/feature/menu id (independent_mst.MSTR_ID
 *                              in the legacy app). We call this the `resourceId` everywhere below.
 *     PERMISSION_ENABLED       master switch — row grants no access at all if this is 0
 *     PERMISSION_READ_ONLY
 *     PERMISSION_MODIFY
 *     PERMISSION_DELETE
 *     PERMISSION_INSERT
 *     PERMISSION_PRINT
 *     PERMISSION_EXECUTE
 *     IS_DELETED                soft-delete flag
 *     OA_ID / OA_BRAND_ID       tenant scoping
 *     USER_ID                   NOT the grantee — this is who the row was created/scoped under
 *                                (mirrors the legacy CI model, kept for parity/audit, not used
 *                                for access decisions)
 *   }
 *
 * IMPORTANT — CONFIGURE BEFORE USE:
 * `PERMISSIONS_REF_TYPE_ID` is a polymorphic discriminator whose concrete numeric values live in
 * your `independent_mst` (TYP_ID = 67 in the legacy app) / equivalent lookup table, not in this
 * codebase. The values below are PLACEHOLDERS. Confirm the real ids and update
 * `PermissionRefType` before relying on this in production — every downstream file imports its
 * values from here, so this is the only place you should need to change.
 */

/** WHO a permission_dtl row is granted to. */
export enum PermissionRefType {
  /** Granted to every user holding a given ROLE_ID (role_mst.ROLE_ID). Most common case. */
  ROLE = 1,
  /** Granted directly to a single USER_ID (user_mst.USER_ID) — per-user override. */
  USER = 2,
  /** Granted to every member of a GROUP_ID (user_group.*). */
  GROUP = 3,
}

/** Action-level flags mirrored 1:1 from permission_dtl's PERMISSION_* columns. */
export enum PermissionAction {
  ENABLED = 'ENABLED', // can see/access the resource at all
  READ_ONLY = 'READ_ONLY',
  MODIFY = 'MODIFY',
  DELETE = 'DELETE',
  INSERT = 'INSERT',
  PRINT = 'PRINT',
  EXECUTE = 'EXECUTE',
}

/** Maps a PermissionAction to its permission_dtl column name. */
export const PERMISSION_ACTION_COLUMN: Record<PermissionAction, string> = {
  [PermissionAction.ENABLED]: 'PERMISSION_ENABLED',
  [PermissionAction.READ_ONLY]: 'PERMISSION_READ_ONLY',
  [PermissionAction.MODIFY]: 'PERMISSION_MODIFY',
  [PermissionAction.DELETE]: 'PERMISSION_DELETE',
  [PermissionAction.INSERT]: 'PERMISSION_INSERT',
  [PermissionAction.PRINT]: 'PERMISSION_PRINT',
  [PermissionAction.EXECUTE]: 'PERMISSION_EXECUTE',
};

/** The subset of the logged-in user's identity the permission engine actually needs. */
export interface PermissionSubject {
  userId: number;
  /** IS_ADMIN / IS_SYSADMIN short-circuit every check (parity with legacy `is_admin` session flag). */
  isAdmin: boolean;
  isSysAdmin: boolean;
  oaId?: number | null;
  oaBrandId?: number | null;
}

/** A raw permission_dtl row, narrowed to the columns the engine cares about. */
export interface PermissionDtlRow {
  PERMISSIONS_DTL_ID: number;
  PERMISSIONS_CLASS_ID: number;
  PERMISSIONS_REF_TYPE_ID: number | null;
  PERMISSIONS_REF_ID: number | null;
  PERMISSIONS_ID: number | null;
  PERMISSION_ENABLED: number;
  PERMISSION_READ_ONLY: number;
  PERMISSION_MODIFY: number;
  PERMISSION_DELETE: number;
  PERMISSION_PRINT: number;
  PERMISSION_EXECUTE: number;
  PERMISSION_INSERT: number;
  IS_DELETED: number;
  OA_ID: number | null;
  OA_BRAND_ID: number | null;
}

/** Fully resolved, de-duplicated permission for a single resource, after merging all sources. */
export interface EffectivePermission {
  resourceId: number;
  enabled: boolean;
  readOnly: boolean;
  modify: boolean;
  delete: boolean;
  insert: boolean;
  print: boolean;
  execute: boolean;
  /** Which ref rows contributed to this result — useful for debugging/audit. */
  sources: Array<{ refType: PermissionRefType; refId: number; dtlId: number }>;
}

export interface PermissionCheckInput {
  subject: PermissionSubject;
  resourceId: number;
  action: PermissionAction;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason:
    | 'ADMIN_BYPASS'
    | 'GRANTED'
    | 'NO_MATCHING_ROW'
    | 'DISABLED'
    | 'ACTION_NOT_GRANTED'
    | 'NO_ROLES';
}

export class PermissionDeniedError extends Error {
  constructor(
    public readonly resourceId: number,
    public readonly action: PermissionAction,
    reason: string,
  ) {
    super(`Permission denied for resource ${resourceId}, action ${action}: ${reason}`);
    this.name = 'PermissionDeniedError';
  }
}

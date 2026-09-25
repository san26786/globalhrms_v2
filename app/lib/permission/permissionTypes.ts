/**
 * app/lib/permission/permissionTypes.ts
 *
 * Shared types for the authorization layer built on `permission_dtl`, modelled on how the CI
 * application (and its data) actually uses that table. `permission_dtl` holds three kinds of row,
 * told apart by PERMISSIONS_REF_TYPE_ID (independent_mst ids of type 48 "Permission ref type"):
 *
 *   65   USER  → CLASS   PERMISSIONS_REF_ID = user_mst.USER_ID   (user is assigned a permission class)
 *   66   ROLE  → CLASS   PERMISSIONS_REF_ID = role_mst.ROLE_ID   (role maps to a permission class)
 *   64   GROUP → CLASS   PERMISSIONS_REF_ID = user_group.USER_GRP_ID
 *   1614 FUNCTION grant  PERMISSIONS_REF_ID = relationship_dtl.REL_DET_ID (a module/functional-epic
 *                        node of the menu hierarchy; menu_config.MENU_ID points to the same id)
 *                        with the PERMISSION_* flags, for one PERMISSIONS_CLASS_ID and OA_BRAND_ID.
 *
 * A user's permission class is resolved like CI login.php::get_permission_class
 * (lib/menu/PermissionClass.ts). A "resource" in this module is therefore a REL_DET_ID, and the
 * flags that apply are the class's 1614 row for that resource in the user's active brand.
 * `PERMISSIONS_ID` is only used by ~100 legacy rows and is ignored.
 */

export enum PermissionRefType {
  GROUP_CLASS = 64,
  USER_CLASS = 65,
  ROLE_CLASS = 66,
  FUNCTION = 1614,
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

/** The subset of the logged-in user's identity the permission engine needs. */
export interface PermissionSubject {
  userId: number;
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

/** Resolved flags for one resource (or a set of resources, OR-merged). */
export interface EffectivePermission {
  resourceId: number | null;
  enabled: boolean;
  readOnly: boolean;
  modify: boolean;
  delete: boolean;
  insert: boolean;
  print: boolean;
  execute: boolean;
  /** Which permission_dtl rows contributed — useful for debugging/audit. */
  sources: number[];
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason:
    | 'SYSADMIN_BYPASS'
    | 'GRANTED'
    | 'NO_PERMISSION_CLASS'
    | 'NO_MATCHING_ROW'
    | 'DISABLED'
    | 'ACTION_NOT_GRANTED'
    | 'UNKNOWN_RESOURCE';
}

export class PermissionDeniedError extends Error {
  constructor(
    public readonly resource: number | string,
    public readonly action: PermissionAction,
    public readonly reason: string,
  ) {
    super(`Permission denied for resource ${resource}, action ${action}: ${reason}`);
    this.name = 'PermissionDeniedError';
  }
}

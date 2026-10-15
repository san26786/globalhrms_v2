/** Permission Class — shapes shared by the API and the form (no server imports here). */

export interface IdOption {
  value: number;
  label: string;
}

/** permission_dtl.PERMISSIONS_REF_TYPE_ID of each tab, resolved on the server from master codes. */
export interface RefTypeIds {
  user: number; // PRTUP (65)
  userGroup: number; // PRTGP (64)
  role: number; // PRTRP (66)
  function: number; // FUNP (1614)
}

export interface FunctionFlags {
  enabled: boolean;
  readonly: boolean;
  modify: boolean;
  delete: boolean;
  insert: boolean;
}

export interface FunctionNode {
  /** relationship_dtl.REL_DET_ID — what permission_dtl.PERMISSIONS_REF_ID stores. */
  relDetId: number;
  name: string;
}

export interface FunctionModule extends FunctionNode {
  /** relationship_dtl.CHILD_MSTR_ID — PARENT_HIER_ID of its children. */
  childMstrId: number | null;
  children: FunctionNode[];
}

/** Ref-type lists of the org (CI getUserListForOaId → {users, roles, userGroups}). */
export interface OrgRefOptions {
  users: IdOption[];
  userGroups: IdOption[];
  roles: IdOption[];
}

export interface PermissionClassSelection {
  /** CI "Access Write" (permissions[]): MSTR_IDs of SYSTEMPERMISSIONTYPE masters (Modify, Delete, Read, Print, Execute Process). */
  accessPermissions: number[];
  users: number[];
  userGroups: number[];
  roles: number[];
  /** REL_DET_ID → flags (CI get_enabled_module). */
  functions: Record<number, FunctionFlags>;
}

export interface PermissionClassInit extends OrgRefOptions {
  mode: 'add' | 'edit';
  /** CI 'New Permission Details' / 'Edit Permission Details'. */
  title: string;
  /** CI is_admin of the caller (0 user, 1 admin, 2 super admin). */
  adminLevel: 0 | 1 | 2;
  classId: number | null;
  className: string;
  oaId: number | null;
  oaBrandId: number | null;
  userId: number | null;
  refTypes: RefTypeIds;
  /** CI "Access Write" checkboxes (independent_mst TYP_ID = SYSTEMPERMISSIONTYPE 1). */
  accessOptions: IdOption[];
  /** CI "Requested By": users of the brand (oa_brands_m::dependableUserBasedOnOrgBrand). */
  requestedByUsers: IdOption[];
  modules: FunctionModule[];
  selection: PermissionClassSelection;
}

export const EMPTY_FLAGS: FunctionFlags = { enabled: false, readonly: false, modify: false, delete: false, insert: false };

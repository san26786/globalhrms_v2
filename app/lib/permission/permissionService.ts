/**
 * app/lib/permission/permissionService.ts
 *
 * Turns raw permission_dtl rows (possibly several, from multiple roles + a direct user override)
 * into a single effective decision per resource.
 *
 * Merge rule (OR-across-sources, matching how the legacy admin UI lets you stack role- and
 * user-level grants): a user has an action on a resource if ANY applicable, enabled row grants
 * it. A row with PERMISSION_ENABLED = 0 contributes nothing, even if its other flags are 1 —
 * ENABLED is the master switch, matching `get_enabled_module` in the legacy model.
 *
 * If your business rules actually need user-level overrides to REVOKE what a role grants
 * (deny-overrides-allow), change `mergeRows` below — that's the only place the merge policy
 * lives.
 */
import { permissionRepository } from './permissionRepository';
import { PermissionRefType } from './permissionTypes';
import type { EffectivePermission, PermissionDtlRow } from './permissionTypes';

function emptyEffectivePermission(resourceId: number): EffectivePermission {
  return {
    resourceId,
    enabled: false,
    readOnly: false,
    modify: false,
    delete: false,
    insert: false,
    print: false,
    execute: false,
    sources: [],
  };
}

function mergeRows(resourceId: number, rows: PermissionDtlRow[]): EffectivePermission {
  const result = emptyEffectivePermission(resourceId);

  for (const row of rows) {
    if (row.PERMISSIONS_ID !== resourceId) continue;
    if (!row.PERMISSION_ENABLED) continue;
    if (row.PERMISSIONS_REF_TYPE_ID === null || row.PERMISSIONS_REF_ID === null) continue;

    result.enabled = true;
    result.readOnly = result.readOnly || !!row.PERMISSION_READ_ONLY;
    result.modify = result.modify || !!row.PERMISSION_MODIFY;
    result.delete = result.delete || !!row.PERMISSION_DELETE;
    result.insert = result.insert || !!row.PERMISSION_INSERT;
    result.print = result.print || !!row.PERMISSION_PRINT;
    result.execute = result.execute || !!row.PERMISSION_EXECUTE;
    result.sources.push({
      refType: row.PERMISSIONS_REF_TYPE_ID as PermissionRefType,
      refId: row.PERMISSIONS_REF_ID,
      dtlId: row.PERMISSIONS_DTL_ID,
    });
  }

  return result;
}

export class PermissionService {
  /** Effective permission for one user on one resource. */
  async getEffectivePermission(userId: number, resourceId: number): Promise<EffectivePermission> {
    const rows = await permissionRepository.getApplicableRows(userId, resourceId);
    return mergeRows(resourceId, rows);
  }

  /**
   * Effective permissions for every resource the user has any grant on — e.g. for building a
   * nav/menu where you need to know which items to render at all. Returns a Map keyed by
   * resourceId (== PERMISSIONS_ID, e.g. a menu/module id).
   */
  async getEffectivePermissionMap(userId: number): Promise<Map<number, EffectivePermission>> {
    const roleIds = await permissionRepository.getActiveRoleIds(userId);
    const [roleRows, userRows] = await Promise.all([
      roleIds.length ? permissionRepository.getAllRoleGrantedRows(userId) : Promise.resolve([]),
      permissionRepository.getAllUserGrantedRows(userId),
    ]);

    const allRows = [...roleRows, ...userRows];
    const byResource = new Map<number, PermissionDtlRow[]>();

    for (const row of allRows) {
      if (row.PERMISSIONS_ID === null) continue;
      const bucket = byResource.get(row.PERMISSIONS_ID) ?? [];
      bucket.push(row);
      byResource.set(row.PERMISSIONS_ID, bucket);
    }

    const result = new Map<number, EffectivePermission>();
    for (const [resourceId, rows] of byResource) {
      result.set(resourceId, mergeRows(resourceId, rows));
    }
    return result;
  }
}

export const permissionService = new PermissionService();

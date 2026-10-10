/**
 * app/lib/permission/permissionService.ts
 *
 * Turns permission_dtl FUNCTION rows into an effective decision.
 *
 * Merge rule: OR across all matching rows. PERMISSION_ENABLED is the master switch — a row with
 * ENABLED = 0 contributes nothing (CI `get_enabled_module` / menu query `PERMISSION_ENABLED = 1`).
 * When a screen maps to several menu entries (same CI controller under different menus), the user
 * has an action if ANY of those entries grants it — the same result CI's URL LIKE check produced.
 */
import { permissionRepository } from './permissionRepository';
import type { EffectivePermission, PermissionDtlRow, PermissionSubject } from './permissionTypes';

function emptyPermission(resourceId: number | null): EffectivePermission {
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

function mergeRows(resourceId: number | null, rows: PermissionDtlRow[]): EffectivePermission {
  const result = emptyPermission(resourceId);
  for (const row of rows) {
    if (!row.PERMISSION_ENABLED) continue;
    result.enabled = true;
    result.readOnly ||= !!row.PERMISSION_READ_ONLY;
    result.modify ||= !!row.PERMISSION_MODIFY;
    result.delete ||= !!row.PERMISSION_DELETE;
    result.insert ||= !!row.PERMISSION_INSERT;
    result.print ||= !!row.PERMISSION_PRINT;
    result.execute ||= !!row.PERMISSION_EXECUTE;
    result.sources.push(row.PERMISSIONS_DTL_ID);
  }
  return result;
}

export interface ResolvedPermission {
  permission: EffectivePermission;
  /** false when the subject has no permission class in its active brand. */
  hasClass: boolean;
}

export class PermissionService {
  /** Effective permission of a subject on a set of REL_DET_ids (menu/function nodes). */
  async getEffectivePermission(
    subject: PermissionSubject,
    resourceIds: number[],
  ): Promise<ResolvedPermission> {
    const resourceId = resourceIds.length === 1 ? resourceIds[0] : null;
    const classId = await permissionRepository.getPermissionsClassId(subject);
    if (!classId || !subject.oaBrandId) {
      return { permission: emptyPermission(resourceId), hasClass: false };
    }
    const rows = await permissionRepository.getFunctionGrants(classId, subject.oaBrandId, resourceIds);
    return { permission: mergeRows(resourceId, rows), hasClass: true };
  }

  /** All FUNCTION grants of the subject's class, keyed by REL_DET_ID (for menus/button states). */
  async getEffectivePermissionMap(subject: PermissionSubject): Promise<Map<number, EffectivePermission>> {
    const result = new Map<number, EffectivePermission>();
    const classId = await permissionRepository.getPermissionsClassId(subject);
    if (!classId || !subject.oaBrandId) return result;

    const rows = await permissionRepository.getFunctionGrants(classId, subject.oaBrandId);
    const byResource = new Map<number, PermissionDtlRow[]>();
    for (const row of rows) {
      if (row.PERMISSIONS_REF_ID === null) continue;
      const bucket = byResource.get(row.PERMISSIONS_REF_ID) ?? [];
      bucket.push(row);
      byResource.set(row.PERMISSIONS_REF_ID, bucket);
    }
    for (const [resourceId, bucket] of byResource) result.set(resourceId, mergeRows(resourceId, bucket));
    return result;
  }
}

export const permissionService = new PermissionService();

'use client';

import EntityListView from '@/components/listview/EntityListView';

/**
 * CI: Permission_class::index() — common_c::getTableDtl('permission_class_mst_vw', 'MSTR_ID',
 * OABRANDID / USERID scoping) rendered by include/listview_v, title from code PCMN. Row actions:
 * Edit (CI user/permission_dtl/editPermissionDtl) and Delete; header actions: Add New Profile Class
 * and Sync (brand admins only). Parameters live in lib/listview/listDefinitions.ts ('permission_class').
 */
export default function PermissionClassUserPage() {
  return <EntityListView list="permission_class_user" />;
}

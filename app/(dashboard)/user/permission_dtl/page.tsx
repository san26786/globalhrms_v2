'use client';

import EntityListView from '@/components/listview/EntityListView';

/**
 * CI: Permission_dtl::index() — common_c::getTableDtl('permission_dtl_vw', 'PERMISSIONS_DTL_ID',
 * ORG_ACC_ID / USERID scoping) rendered by include/listview_v. Header action "Add New Permission
 * Details" (the Permission Class form); no row edit / delete, Delete Selected soft-deletes.
 * Parameters live in lib/listview/listDefinitions.ts ('permission_dtl').
 */
export default function PermissionDtlPage() {
  return <EntityListView list="permission_dtl" title="Permission Details" />;
}

/**
 * Phase 15 — Dynamic Sidebar/Menu
 *
 * Shape returned by /api/menu and consumed by useSidebarMenu().
 * Mirrors the recursive structure the legacy left_menu_v.php built by
 * calling get_menu_from_relationship() again for every module's
 * CHILD_MSTR_ID.
 */

export interface MenuNode {
  /** REL_DET_ID — unique id of this relationship_dtl row */
  id: number;
  /** im.MSTR_NM — display label */
  name: string;
  /**
   * CHILD_ID / CHILD_MSTR_ID — used as the PARENT_ID for the next
   * recursive lookup. Null when the row has no independent_mst match
   * (LEFT JOIN miss), matching the PHP behaviour of still rendering
   * the row but not being able to recurse into it.
   */
  childMstrId: number | null;
  /** md.URL — raw url fragment as stored (already relative to site root) */
  url: string | null;
  /** md.SMALL_VIEW_ICON — legacy uploaded icon filename, if you want to use it later */
  smallViewIcon: string | null;
  /** Recursively resolved children */
  children: MenuNode[];
}

export interface MenuQueryParams {
  /** true => old is_admin == 2 (super-admin) path, no permission filtering, no brand scoping */
  isSysAdmin: boolean;
  oaBrandId: number;
  /** null only valid when isSysAdmin is true */
  permissionsClassId: number | null;
  /** old session->userdata('brandApplicationID'); see permissionClass.ts / route.ts TODO */
  brandApplicationId: number | null;
  showTabs: boolean;
  parentId: number;
}

export interface RawMenuRow {
  MENU_NAME: string;
  REL_DET_ID: number;
  CHILD_MSTR_ID: number | null;
  URL: string | null;
  SMALL_VIEW_ICON: string | null;
}
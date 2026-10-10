/**
 * Phase 15 — Dynamic Sidebar/Menu
 *
 * Shape returned by /api/menu and consumed by the navigation context (lib/navigation).
 * Mirrors the recursive structure the legacy left_menu_v.php built by
 * calling get_menu_from_relationship() again for every module's
 * CHILD_MSTR_ID.
 */

import type { ResolvedLink } from '@/lib/navigation/routeRegistry';

export interface MenuNode {
  /** REL_DET_ID — unique id of this relationship_dtl row (CI: data-menu-id="menu_{id}") */
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
  /** menu_config.URL — raw CI URI as stored (relative to site root, '#' for groups) */
  url: string | null;
  /** Where `url` lives in this app (lib/navigation/routeRegistry): resolved on the server. */
  link: ResolvedLink;
  /** menu_config.SMALL_VIEW_ICON — legacy uploaded icon filename (CI img/SMALL_VIEW_ICON/…) */
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
  /** CI session brandApplicationID: brand setting SSABAN, default 370 (set at login). */
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

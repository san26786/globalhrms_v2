import { getMenuTree, queryMenuLevel } from '@/lib/menu/MenuService';
import type { MenuNode, MenuQueryParams } from '@/lib/menu/types';
import { permissionEngine, PermissionAction } from '@/lib/permission';
import { permissionRepository } from '@/lib/permission/permissionRepository';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { prisma } from '@/lib/prisma';
import { getBrandContext } from '@/lib/session/brandContext';
import { PROFILE_MENU, SETTINGS_MENU, visibleMenuItems } from '@/lib/header/headerMenus';
import type { HeaderSession } from '@/lib/header/headerSession';
import { ciUrlForLocation, normalizeCiPath, resolveCiUrl, type ResolvedLink } from './routeRegistry';

/**
 * CI header_v links (Profile / Settings dropdowns) are shown by admin level alone, and their
 * controllers did not check menu grants — e.g. Settings → Brand Settings / Module Settings for every
 * admin. A page the caller's header links to is therefore allowed even without a menu grant. The
 * header's own visibility rules (lib/header/headerMenus) decide, so the two can never disagree.
 */
function headerLinkedCiPaths(subject: RequestSubject): Set<string> {
  const session: HeaderSession = {
    isLoggedIn: true,
    userLevel: subject.adminLevel,
    oaId: subject.oaId,
    alerts: { count: 0, recent: [] },
  };
  return new Set(
    visibleMenuItems([...PROFILE_MENU, ...(subject.adminLevel !== 0 ? SETTINGS_MENU : [])], session).map((item) =>
      normalizeCiPath(item.href(session)),
    ),
  );
}

/** CI left_menu_v: get_menu_from_relationship($oa_brand_id, …, $parent_id = 370). */
export const MENU_ROOT_PARENT_ID = 370;

export interface MenuRequest {
  parentId?: number;
  /** CI $show_tabs: only rows with menu_config.SHOW_TAB = 1. */
  showTabs?: boolean;
}

/**
 * The left menu for the caller, exactly as CI built it: sysadmin sees the whole hierarchy,
 * everyone else only the FUNCTION grants (permission_dtl ref 1614, ENABLED) of their permission
 * class in the active brand, limited to licensed/enabled modules and their brand application.
 * Each node carries its resolved Next.js link.
 */
export async function getNavigationMenu(subject: RequestSubject, request: MenuRequest = {}): Promise<MenuNode[]> {
  const params = await menuQueryParams(subject, request);
  return params ? getMenuTree(params) : [];
}

/** The menu query for the caller, or null when CI returned no menu at all (no brand / no permission class). */
async function menuQueryParams(subject: RequestSubject, request: MenuRequest): Promise<MenuQueryParams | null> {
  if (!subject.oaBrandId) return null;

  let permissionsClassId: number | null = null;
  if (!subject.isSysAdmin) {
    permissionsClassId = await permissionRepository.getPermissionsClassId(subject);
    // CI: if (empty($permissions_class_id)) return array();
    if (permissionsClassId === null) return null;
  }

  const brand = await getBrandContext(subject.oaBrandId);
  return {
    isSysAdmin: subject.isSysAdmin,
    oaBrandId: subject.oaBrandId,
    permissionsClassId,
    brandApplicationId: brand.brandApplicationId,
    showTabs: request.showTabs ?? false,
    parentId: request.parentId ?? MENU_ROOT_PARENT_ID,
  };
}

export interface ChildMenuItem {
  /** REL_DET_ID */
  id: number;
  name: string;
  link: ResolvedLink;
}

export interface ChildMenuModel {
  menuId: number;
  title: string;
  items: ChildMenuItem[];
}

/**
 * CI dashboard/dashboard::ChildMenu($id) — the tiles page behind header "Advance Setting" and
 * "Support Center": the menu's name (getMenuName) and the caller's permitted, shown (SHOW_MENU = 1)
 * items one level below it (getChildMenu($id, false, true)), in menu order. CI linked an item with an
 * empty URL to that item's own ChildMenu page and an http(s) URL as an external link.
 */
export async function getChildMenu(subject: RequestSubject, menuId: number): Promise<ChildMenuModel> {
  const [title, params] = await Promise.all([menuName(menuId), menuQueryParams(subject, { parentId: menuId })]);
  const rows = params ? await queryMenuLevel(params) : [];
  return {
    menuId,
    title: title ?? 'Menu',
    items: rows.map((row) => ({
      id: row.REL_DET_ID,
      name: row.MENU_NAME,
      link:
        !row.URL?.trim() && row.CHILD_MSTR_ID != null
          ? resolveCiUrl(`dashboard/dashboard/ChildMenu/${row.CHILD_MSTR_ID}`)
          : resolveCiUrl(row.URL),
    })),
  };
}

/** CI dashboardnew_m::getMenuName($id): the mapped master's name, else the master's own name. */
async function menuName(menuId: number): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ name: string | null }>>`
    SELECT COALESCE(
      (SELECT im."MSTR_NM" FROM config_mapping_dtl cm JOIN independent_mst im ON im."MSTR_ID" = cm."TRGT_ENTTY_ID"
        WHERE cm."SRC_ENTTY_ID" = ${menuId} ORDER BY im."MSTR_ID" LIMIT 1),
      (SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = ${menuId} ORDER BY im."MSTR_ID" LIMIT 1)
    ) AS name`;
  return rows[0]?.name ?? null;
}

export type AccessDecision =
  | { allowed: true; ciUrl: string | null }
  | { allowed: false; ciUrl: string; reason: string };

/**
 * Page-level guard: the page at `pathname` is allowed when it is not a menu screen (profile,
 * change password, …), when its CI menu URL has no menu_config rows, or when the caller holds
 * the ENABLED grant that also decides whether CI showed that menu item. APIs enforce the
 * action-level grants (INSERT / MODIFY / DELETE) on their own.
 */
export async function checkPageAccess(
  subject: RequestSubject,
  pathname: string,
  search: URLSearchParams,
): Promise<AccessDecision> {
  const ciUrl = ciUrlForLocation(pathname, search);
  if (!ciUrl || subject.isSysAdmin) return { allowed: true, ciUrl };
  if (headerLinkedCiPaths(subject).has(normalizeCiPath(ciUrl))) return { allowed: true, ciUrl };

  const resourceIds = await permissionRepository.getMenuResourceIds(ciUrl);
  if (resourceIds.length === 0) return { allowed: true, ciUrl };

  const result = await permissionEngine.evaluateMenu(subject, ciUrl, PermissionAction.ENABLED);
  return result.allowed ? { allowed: true, ciUrl } : { allowed: false, ciUrl, reason: result.reason };
}

import { getMenuTree } from '@/lib/menu/MenuService';
import type { MenuNode } from '@/lib/menu/types';
import { permissionEngine, PermissionAction } from '@/lib/permission';
import { permissionRepository } from '@/lib/permission/permissionRepository';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { getBrandContext } from '@/lib/session/brandContext';
import { PROFILE_MENU, SETTINGS_MENU, visibleMenuItems } from '@/lib/header/headerMenus';
import type { HeaderSession } from '@/lib/header/headerSession';
import { ciUrlForLocation, normalizeCiPath } from './routeRegistry';

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
  if (!subject.oaBrandId) return [];

  let permissionsClassId: number | null = null;
  if (!subject.isSysAdmin) {
    permissionsClassId = await permissionRepository.getPermissionsClassId(subject);
    // CI: if (empty($permissions_class_id)) return array();
    if (permissionsClassId === null) return [];
  }

  const brand = await getBrandContext(subject.oaBrandId);
  return getMenuTree({
    isSysAdmin: subject.isSysAdmin,
    oaBrandId: subject.oaBrandId,
    permissionsClassId,
    brandApplicationId: brand.brandApplicationId,
    showTabs: request.showTabs ?? false,
    parentId: request.parentId ?? MENU_ROOT_PARENT_ID,
  });
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

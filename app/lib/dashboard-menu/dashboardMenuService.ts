/**
 * app/lib/dashboard-menu/dashboardMenuService.ts
 *
 * Business logic only — no Prisma, no HTTP. Mirrors:
 *   - Dashboard_menu::setFormControls()  → decides upload vs. keep-existing,
 *     decides create vs. edit
 *   - Generateall_m::create_menu()'s branch on parentId == 370
 *   - Dashboard_menu::initForm()'s parent-module dropdown
 *     (Generateall_m::getChildMenu(PARENT_MENU_ID)) — reused from
 *     lib/menu/MenuService.queryMenuLevel rather than re-querying.
 */
import type { PermissionSubject } from '@/lib/permission';
import { resolvePermissionsClassId } from '@/lib/menu/PermissionClass';
import { queryMenuLevel } from '@/lib/menu/MenuService';
import { dashboardMenuRepository } from './dashboardMenuRepository';
import { saveIcon, type IconKind } from './iconUpload';
import {
  DASHBOARD_MENU_DEFAULT_ICONS,
  DASHBOARD_MENU_HIERARCHY,
  DASHBOARD_MENU_ROOT_PARENT_CD,
  DASHBOARD_MENU_ROOT_PARENT_ID,
} from './constants';
import type { CreateDashboardMenuInput, UpdateDashboardMenuInput } from '@/validations/dashboardMenu.schema';
import type {
  DashboardMenuDetail,
  DashboardMenuIconFiles,
  DashboardMenuListItem,
  DashboardMenuParentOption,
} from './types';

export class DashboardMenuService {
  async listMenus(): Promise<DashboardMenuListItem[]> {
    return dashboardMenuRepository.listMenus();
  }

  async getMenu(id: number): Promise<DashboardMenuDetail | null> {
    return dashboardMenuRepository.getMenuById(id);
  }

  /**
   * CI: Dashboard_menu::initForm() → getChildMenu(PARENT_MENU_ID). Reuses
   * the exact same permission-aware query the sidebar uses (same two admin
   * vs. non-admin branches, same brand/permission-class scoping), just for
   * one level instead of recursively — this IS the same business rule, not
   * a re-implementation of it.
   */
  async getParentModuleOptions(subject: PermissionSubject): Promise<DashboardMenuParentOption[]> {
    const isSysAdmin = !!subject.isSysAdmin;
    let permissionsClassId: number | null = null;

    if (!isSysAdmin) {
      if (!subject.oaBrandId || !subject.userId) return [];
      const resolved = await resolvePermissionsClassId(subject.oaBrandId, subject.userId);
      permissionsClassId = resolved.permissionsClassId;
      if (!permissionsClassId) return []; // CI: `if (empty($permissions_class_id)) return null;`
    }

    const rows = await queryMenuLevel({
      isSysAdmin,
      oaBrandId: subject.oaBrandId ?? 0,
      permissionsClassId,
      // brandApplicationId resolution is an open TODO already flagged in
      // lib/menu/types.ts / PermissionClass.ts in the codebase as supplied;
      // passing null relies on the query's own `APP_ID IS NULL OR APP_ID = 0`
      // fallback branch, which is the same degraded-but-functional behaviour
      // any other caller of queryMenuLevel currently gets.
      brandApplicationId: null,
      showTabs: false,
      parentId: DASHBOARD_MENU_ROOT_PARENT_ID,
    });

    return rows
      .filter((row) => row.CHILD_MSTR_ID != null)
      .map((row) => ({ value: row.CHILD_MSTR_ID as number, label: row.MENU_NAME }));
  }

  /**
   * CI: Dashboard_menu::setFormControls() (actionMode === 0 branch) →
   * Generateall_m::create_menu().
   */
  async createMenu(input: CreateDashboardMenuInput, files: DashboardMenuIconFiles): Promise<{ id: number }> {
    const parentId = input.parentModuleId ?? DASHBOARD_MENU_ROOT_PARENT_ID;
    const isRoot = parentId === DASHBOARD_MENU_ROOT_PARENT_ID;
    const branch = isRoot ? DASHBOARD_MENU_HIERARCHY.root : DASHBOARD_MENU_HIERARCHY.child;

    const parentCd = isRoot
      ? DASHBOARD_MENU_ROOT_PARENT_CD
      : await dashboardMenuRepository.getMasterCodeFromId(parentId);
    if (!parentCd) {
      throw new Error(`Could not resolve MSTR_CD for parent module ${parentId}`);
    }

    const epicCode = `${branch.epicCodePrefix}${input.menuCode}`;
    const menuCode = `${branch.menuCodePrefix}${input.menuCode}`;
    const epicName = isRoot ? input.menuName : `${input.menuName} Epic`;
    const modName = isRoot ? `${input.menuName} Management` : input.menuName;

    const [small, medium, block] = await Promise.all([
      saveIcon(files.small, 'small' as IconKind),
      saveIcon(files.medium, 'medium' as IconKind),
      saveIcon(files.block, 'block' as IconKind),
    ]);

    const result = await dashboardMenuRepository.createMenu({
      epicCode,
      epicName,
      epicTypeId: branch.epicTypeId,
      menuCode,
      menuItemName: modName,
      menuItemTypeId: branch.menuItemTypeId,
      parentId,
      parentCd,
      businessLayerObjectId: branch.businessLayerObjectId,
      moduleFunctionTypeId: branch.moduleFunctionTypeId,
      applicationTypeId: branch.applicationTypeId,
      requirementHierarchyTypeId: DASHBOARD_MENU_HIERARCHY.requirementHierarchyTypeId,
      url: input.menuUrl,
      smallIcon: small ?? DASHBOARD_MENU_DEFAULT_ICONS.small,
      mediumIcon: medium ?? DASHBOARD_MENU_DEFAULT_ICONS.medium,
      blockIcon: block ?? DASHBOARD_MENU_DEFAULT_ICONS.block,
      sequence: input.sequence,
    });

    return { id: result.menuConfigId };
  }

  /** CI: Dashboard_menu::setFormControls() (actionMode === 1 branch) → Generateall_m::edit_menu(). */
  async updateMenu(id: number, input: UpdateDashboardMenuInput, files: DashboardMenuIconFiles): Promise<void> {
    const [small, medium, block] = await Promise.all([
      saveIcon(files.small, 'small' as IconKind),
      saveIcon(files.medium, 'medium' as IconKind),
      saveIcon(files.block, 'block' as IconKind),
    ]);

    await dashboardMenuRepository.updateMenu({
      menuConfigId: id,
      url: input.menuUrl,
      sequence: input.sequence,
      menuName: input.menuName,
      ...(small ? { smallIcon: small } : {}),
      ...(medium ? { mediumIcon: medium } : {}),
      ...(block ? { blockIcon: block } : {}),
    });
  }
}

export const dashboardMenuService = new DashboardMenuService();

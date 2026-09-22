/**
 * Utilities → Dashboard Menu
 *
 * Constants ported from the legacy CI controller/model:
 *   - Dashboard_menu.php  (initForm, uploadFile/1/2)
 *   - Generateall_m.php   (create_menu — the `if ($parentId == 370)` branch)
 *
 * These are the same literal ids/codes the PHP hardcoded. None of them are
 * derivable from the schema — they are lookup rows in independent_mst /
 * common_type that must already exist in the seeded data (TYP_ID 76/77/83/84,
 * hierarchy ids 18/19/74/75/76). If your seed data uses different ids for
 * these lookups, update this file only — nothing else in the module embeds
 * these numbers directly.
 */

/**
 * independent_mst.MSTR_ID of the root menu anchor. CI hardcoded this as the
 * literal `370` in both Dashboard_menu::initForm() (`getChildMenu(PARENT_MENU_ID)`)
 * and Generateall_m::create_menu() (`if ($parentId == 370)`) — the same
 * constant, so it is centralized here as one value.
 */
export const DASHBOARD_MENU_ROOT_PARENT_ID = 370;

/** MSTR_CD of the root parent row — CI hardcodes this alongside id 370. */
export const DASHBOARD_MENU_ROOT_PARENT_CD = 'IMSA';

/**
 * independent_mst.TYP_ID / hierarchy constants, branching on whether the
 * chosen parent module IS the root (370) or a child module under it.
 * Mirrors Generateall_m::create_menu() exactly.
 */
export const DASHBOARD_MENU_HIERARCHY = {
  root: {
    epicCodePrefix: 'MM',
    menuCodePrefix: 'MF',
    epicTypeId: 76,
    menuItemTypeId: 83,
    businessLayerObjectId: 18,
    moduleFunctionTypeId: 76,
    applicationTypeId: 75,
  },
  child: {
    epicCodePrefix: 'FE',
    menuCodePrefix: 'MI',
    epicTypeId: 77,
    menuItemTypeId: 84,
    businessLayerObjectId: 19,
    moduleFunctionTypeId: 77,
    applicationTypeId: 76,
  },
  /** HIER_TYPE_ID for every relationship_dtl row this module creates. */
  requirementHierarchyTypeId: 74,
} as const;

/** Fallback icon filenames when no file is uploaded — CI: create_menu()'s empty() checks. */
export const DASHBOARD_MENU_DEFAULT_ICONS = {
  small: '3.1.png',
  medium: '3.png',
  block: 'Timesheet.png',
} as const;

/**
 * Upload sub-directories under /public/img — CI wrote to
 * APPPATH.'../img/SMALL_VIEW_ICON', '../img/MEDIUM_VIEW_ICON',
 * '../img/BLOCK_MENU_ICON' respectively (uploadFile / uploadFile2 / uploadFile1).
 */
export const DASHBOARD_MENU_ICON_DIRS = {
  small: 'SMALL_VIEW_ICON',
  medium: 'MEDIUM_VIEW_ICON',
  block: 'BLOCK_MENU_ICON',
} as const;

/** Same whitelist as CI's $allowedTypes in uploadFile/uploadFile1/uploadFile2. */
export const DASHBOARD_MENU_ALLOWED_ICON_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'jfif',
  'tiff',
] as const;

/** CI's $config['max_size'] = '10240' is in KB (CI upload lib convention) → 10 MB. */
export const DASHBOARD_MENU_MAX_ICON_BYTES = 10 * 1024 * 1024;

/**
 * PERMISSIONS_ID (independent_mst.MSTR_ID) that gates the Dashboard Menu
 * admin screen itself. NOT present anywhere in the supplied CI code — the CI
 * controller had no explicit permission_dtl check of its own, it only sat
 * behind the generic authenticated-admin CI session. Until this is set to a
 * real seeded resource id, server-side enforcement in this module falls back
 * to "must be IS_ADMIN or IS_SYSADMIN", matching that implicit legacy gate.
 * See lib/dashboard-menu/authorization.ts.
 */
export const DASHBOARD_MENU_RESOURCE_ID: number | null = null;

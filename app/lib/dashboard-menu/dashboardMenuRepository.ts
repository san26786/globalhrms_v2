/**
 * app/lib/dashboard-menu/dashboardMenuRepository.ts
 *
 * All direct database access for the Dashboard Menu module lives here —
 * nothing outside this file (and lib/menu/MenuService.ts, reused as-is for
 * the parent-module dropdown) touches Prisma or raw SQL for this feature.
 *
 * config_mapping_dtl note: no Prisma model for it was included in the
 * schema fragment supplied alongside this task, but its columns
 * (SRC_ENTTY_ID / TRGT_ENTTY_ID / SRC_ENTTY_CD / TRGT_ENTTY_CD /
 * CNFG_MPPNG_TYP_ID) are already relied on verbatim by the existing
 * lib/menu/MenuService.ts via $queryRaw — so it does already exist in the
 * full schema.prisma, this file just doesn't have a generated model type to
 * import. We follow the same $queryRaw / $executeRaw approach already
 * established there rather than guessing at a model name.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import {
  DASHBOARD_MENU_ROOT_PARENT_CD,
  DASHBOARD_MENU_ROOT_PARENT_ID,
} from './constants';
import type {
  CreateDashboardMenuInput,
  DashboardMenuDetail,
  DashboardMenuListItem,
} from './types';

type Tx = Prisma.TransactionClient;

export interface CreateMenuRow {
  epicCode: string;
  epicName: string;
  epicTypeId: number;
  menuCode: string;
  menuItemName: string;
  menuItemTypeId: number;
  parentId: number;
  parentCd: string;
  businessLayerObjectId: number;
  moduleFunctionTypeId: number;
  applicationTypeId: number;
  requirementHierarchyTypeId: number;
  url: string;
  smallIcon: string;
  mediumIcon: string;
  blockIcon: string;
  sequence: number;
}

export interface UpdateMenuRow {
  menuConfigId: number;
  url: string;
  smallIcon?: string;
  mediumIcon?: string;
  blockIcon?: string;
  sequence: number;
  menuName: string;
}

export class DashboardMenuRepository {
  /** Looks up an independent_mst row's MSTR_CD by id — CI: Indp_mst_data_m::getMasterCodeFromId(). */
  async getMasterCodeFromId(mstrId: number): Promise<string | null> {
    if (mstrId === DASHBOARD_MENU_ROOT_PARENT_ID) {
      return DASHBOARD_MENU_ROOT_PARENT_CD;
    }
    const row = await prisma.independent_mst.findUnique({
      where: { MSTR_ID: mstrId },
      select: { MSTR_CD: true },
    });
    return row?.MSTR_CD ?? null;
  }

  async listMenus(): Promise<DashboardMenuListItem[]> {
    const rows = await prisma.menu_config.findMany({
      orderBy: [{ sequence: 'asc' }, { MENU_NM: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.ID,
      mstrId: row.MSTR_ID ?? 0,
      menuName: row.MENU_NM ?? '',
      url: row.URL,
      sequence: row.sequence,
      showTab: row.SHOW_TAB === 1,
      showMenu: row.SHOW_MENU === 1,
    }));
  }

  /**
   * CI: Dashboard_menu::initForm() calls
   *   $menuid  = getMunuid($id, 1);                 // menu_config.MSTR_ID  → the EPIC's mstr id
   *   $epicid  = getMstridFromEpic($menuid['value']); // config_mapping_dtl SRC=epic → TRGT (menu-item id)
   *   $MenuName = getModuleName($epicid, 1);          // reads MSTR_NM from the MENU-ITEM row, not the epic
   * i.e. despite the variable being named `$epicid`, the name shown and later
   * saved on edit is the **menu item's** independent_mst.MSTR_NM/MSTR_CD.
   * getMenuItemMstrIdForEpic() below is the `getMstridFromEpic` step.
   */
  async getMenuById(id: number): Promise<DashboardMenuDetail | null> {
    const row = await prisma.menu_config.findUnique({ where: { ID: id } });
    if (!row || !row.MSTR_ID) return null;

    const menuItemMstrId = await this.getMenuItemMstrIdForEpic(row.MSTR_ID);
    const menuItem = menuItemMstrId
      ? await prisma.independent_mst.findUnique({
          where: { MSTR_ID: menuItemMstrId },
          select: { MSTR_NM: true, MSTR_CD: true },
        })
      : null;

    return {
      id: row.ID,
      mstrId: row.MSTR_ID,
      menuName: menuItem?.MSTR_NM ?? row.MENU_NM ?? '',
      menuCode: menuItem?.MSTR_CD ?? row.MSTR_CD ?? null,
      url: row.URL,
      sequence: row.sequence,
      showTab: row.SHOW_TAB === 1,
      showMenu: row.SHOW_MENU === 1,
      smallViewIcon: row.SMALL_VIEW_ICON,
      mediumViewIcon: row.MEDIUM_VIEW_ICON,
      blockMenuIcon: row.BLOCK_MENU_ICON,
    };
  }

  /**
   * Resolves the independent_mst.MSTR_ID that holds the editable menu-item
   * name/code (independent_mst → config_mapping_dtl.TRGT_ENTTY_ID, keyed by
   * the epic's SRC_ENTTY_ID). CI: Generateall_m::getMstridFromEpic(),
   * originally re-derived on every request via a session round-trip
   * (session('menu_id') written in initForm, read back in setFormControls).
   * Resolving it fresh here from menu_config.MSTR_ID removes that
   * session dependency entirely — stateless by construction.
   */
  async getMenuItemMstrIdForEpic(epicMstrId: number): Promise<number | null> {
    const rows = await prisma.$queryRaw<{ TRGT_ENTTY_ID: number }[]>`
      SELECT "TRGT_ENTTY_ID" FROM "config_mapping_dtl" WHERE "SRC_ENTTY_ID" = ${epicMstrId} LIMIT 1
    `;
    return rows[0]?.TRGT_ENTTY_ID ?? null;
  }

  /**
   * Full create transaction — CI: Generateall_m::create_menu(). Ports the
   * five inserts, but skips the six raw `UPDATE ... JOIN` statements CI ran
   * afterward to backfill ID columns from CD columns: those existed only
   * because the PHP inserts didn't reuse insert_id() consistently. Here every
   * FK is the actual id returned by the prior insert, so there is nothing
   * left to backfill.
   */
  async createMenu(row: CreateMenuRow): Promise<{ menuConfigId: number; epicMstrId: number }> {
    return prisma.$transaction(async (tx: Tx) => {
      const epic = await tx.independent_mst.create({
        data: { MSTR_CD: row.epicCode, MSTR_NM: row.epicName, TYP_ID: row.epicTypeId },
        select: { MSTR_ID: true },
      });

      const menuItem = await tx.independent_mst.create({
        data: { MSTR_CD: row.menuCode, MSTR_NM: row.menuItemName, TYP_ID: row.menuItemTypeId },
        select: { MSTR_ID: true },
      });

      await tx.$executeRaw`
        INSERT INTO "config_mapping_dtl"
          ("SRC_ENTTY_ID", "TRGT_ENTTY_ID", "SRC_ENTTY_CD", "TRGT_ENTTY_CD", "CNFG_MPPNG_TYP_ID")
        VALUES (${epic.MSTR_ID}, ${menuItem.MSTR_ID}, ${row.epicCode}, ${row.menuCode}, ${row.menuItemTypeId})
      `;

      const relationship = await tx.relationship_dtl.create({
        data: {
          HIER_LEVEL_CONFIG_ID: row.businessLayerObjectId,
          CHILD_ID: epic.MSTR_ID,
          PARENT_ID: row.parentId,
          CHILD_CD: row.epicCode,
          PARENT_CD: row.parentCd,
          HIER_TYPE_ID: row.requirementHierarchyTypeId,
          HIER_CHILD_ENTITY_TYPE_ID: row.moduleFunctionTypeId,
          HIER_PARENT_ENTITY_TYPE_ID: row.applicationTypeId,
          LEVEL_SEQ: 1,
          ENABLED: 1,
        },
        select: { REL_DET_ID: true },
      });

      const menuConfig = await tx.menu_config.create({
        data: {
          MSTR_ID: epic.MSTR_ID,
          MSTR_CD: row.epicCode,
          MENU_NM: row.epicName,
          ICON: '0',
          BLOCK_MENU_ICON: row.blockIcon,
          MEDIUM_VIEW_ICON: row.mediumIcon,
          SMALL_VIEW_ICON: row.smallIcon,
          URL: row.url,
          MENU_ID: relationship.REL_DET_ID,
          CLASS: '',
          SHOW_TAB: 1,
          SHOW_MENU: 1,
          sequence: row.sequence,
        },
        select: { ID: true },
      });

      return { menuConfigId: menuConfig.ID, epicMstrId: epic.MSTR_ID };
    });
  }

  /**
   * CI: Generateall_m::edit_menu(). Updates menu_config (icons/url) and the
   * menu-item's independent_mst row (name). Deliberately does NOT write
   * MSTR_CD: the CI edit form never renders a menu_code input (only create
   * mode does), so `$this->input->post('menu_code')` was always empty on
   * every edit submission and CI's edit_menu() silently overwrote the
   * existing code with '' on every save — a data-loss bug in the legacy
   * code, not a business rule worth preserving. Omitting the field here
   * simply leaves the existing code untouched.
   */
  async updateMenu(row: UpdateMenuRow): Promise<void> {
    await prisma.$transaction(async (tx: Tx) => {
      const menuConfig = await tx.menu_config.findUnique({
        where: { ID: row.menuConfigId },
        select: { MSTR_ID: true },
      });
      if (!menuConfig?.MSTR_ID) {
        throw new Error(`menu_config ${row.menuConfigId} not found or missing MSTR_ID`);
      }

      await tx.menu_config.update({
        where: { ID: row.menuConfigId },
        data: {
          URL: row.url,
          sequence: row.sequence,
          ...(row.smallIcon ? { SMALL_VIEW_ICON: row.smallIcon } : {}),
          ...(row.mediumIcon ? { MEDIUM_VIEW_ICON: row.mediumIcon } : {}),
          ...(row.blockIcon ? { BLOCK_MENU_ICON: row.blockIcon } : {}),
        },
      });

      const menuItemMstrIdRows = await tx.$queryRaw<{ TRGT_ENTTY_ID: number }[]>`
        SELECT "TRGT_ENTTY_ID" FROM "config_mapping_dtl" WHERE "SRC_ENTTY_ID" = ${menuConfig.MSTR_ID} LIMIT 1
      `;
      const menuItemMstrId = menuItemMstrIdRows[0]?.TRGT_ENTTY_ID;
      if (!menuItemMstrId) {
        throw new Error(`No config_mapping_dtl row found for epic ${menuConfig.MSTR_ID}`);
      }

      // Matches CI exactly: only the menu-item's independent_mst row is
      // updated (`$this->db->where('MSTR_ID', $menuid)` where $menuid is the
      // menu-item id, not the epic). CI's edit_menu() never touches the
      // epic's own independent_mst.MSTR_NM.
      await tx.independent_mst.update({
        where: { MSTR_ID: menuItemMstrId },
        data: { MSTR_NM: row.menuName },
      });

      // menu_config.MENU_NM is not written by CI's edit_menu() either, and is
      // left alone here for the same reason — this column reflects the name
      // given at *creation* time and is allowed to drift from a later rename,
      // exactly as in the legacy behaviour.
    });
  }
}

export const dashboardMenuRepository = new DashboardMenuRepository();

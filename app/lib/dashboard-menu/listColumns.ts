// lib/dashboard-menu/listColumns.ts
import type { DisplayField } from '@/lib/table-builder/columnBuilder';
import type { TableDtlResult } from '@/lib/table-builder/getTableDtl';

/**
 * Raw menu_config_vw column -> DashboardMenuListItem field. Single source
 * of truth shared conceptually with toListItem() in route.ts, so the two
 * can never drift apart.
 */
const RAW_TO_LIST_ITEM_KEY: Record<string, string> = {
  ID: 'id',
  MSTR_ID: 'mstrId',
  MENU_NM: 'menuName',
  URL: 'url',
  sequence: 'sequence', // lowercase in menu_config / menu_config_vw
  SHOW_TAB: 'showTab',
  SHOW_MENU: 'showMenu',
};

/**
 * Turns getTableDtl()'s metadata-driven column list (raw DB accessorKeys,
 * display-name overrides, list-view visibility already resolved) into the
 * camelCase keys toListItem() actually puts on each row — same columns,
 * same order, same labels CI's index() would have shown, just keyed to
 * match what the client receives.
 */
export function buildListColumns<T>(result: TableDtlResult<T>): DisplayField[] {
  return result.getSystemData
    .filter((a) => result.getVisibleColForLV[a.OBJ_ATTRBT_ID] !== false)
    .map((a) => {
      const key = RAW_TO_LIST_ITEM_KEY[a.OBJ_ATTRBT_NM];
      if (!key) return null; // raw column has no client-side field yet — skip rather than guess
      return {
        accessorKey: key,
        header: result.entityObjAttrbtDetails[a.OBJ_ATTRBT_ID] || a.OBJ_ATTRBT_NM,
      } satisfies DisplayField;
    })
    .filter((f): f is DisplayField => f !== null);
}
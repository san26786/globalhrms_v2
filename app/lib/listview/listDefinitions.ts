import type { AccessPolicy } from '@/lib/resource/types';
import { menuPolicy } from '@/lib/resource/policies';

/**
 * Generic list screens — one entry per CI controller index(), holding exactly the arguments that
 * controller passed to common_c::getTableDtl() plus its $listActions / $actions / $deleteAll.
 * NO columns here: which columns are listed, their labels and their order come from the entity
 * configuration (entity_obj_attrbt / entity_obj_attrbt_dsply_dtl) at request time, as in CI.
 *
 * A list works as soon as its objNm exists in PostgreSQL. The CI MySQL views (*_vw) were not
 * migrated; recreate a view, add its entry here, and the page is just
 * `<EntityListView list="key" />`.
 */
export interface ListDefinition {
  /** CI $head['title']. */
  title: string;
  /** CI $pvs_ObjNm — table or view listed (also the Form Settings object). */
  objNm: string;
  /** CI $primaryKeyColumn. */
  primaryKey: string;
  /** CI menu URL: its permission_dtl FUNCTION grant decides list / add / edit / delete. */
  policy: AccessPolicy;
  /** CI $colNm / $colValue static filter. */
  where?: { column: string; value: string | number };
  /** CI $orgColumName (+ $orgID = session brand), applied to brand admins. */
  orgColumn?: string;
  /** CI $userColumnName (+ $userID = session user), applied to normal users. */
  userColumn?: string;
  /** CI $listActions "Add New …": the Next add page. */
  addHref?: string;
  /** CI $actions['edit']: the Next edit page; `/{primary key}` is appended. */
  editHref?: string;
  /** CI $actions['delete'] / Delete Selected: the API item route; DELETE `${deleteApi}/{id}`. */
  deleteApi?: string;
  /** CI $deleteAll (default true when deleteApi is set). */
  deleteAll?: boolean;
}

export const LIST_DEFINITIONS = {
  /** CI utilities/dashboard_menu::index() */
  dashboard_menu: {
    title: 'Create Menu',
    objNm: 'menu_config_vw',
    primaryKey: 'ID',
    policy: menuPolicy('utilities/dashboard_menu'),
    addHref: '/utilities/dashboard-menu/add',
    editHref: '/utilities/dashboard-menu/edit',
    deleteAll: false, // CI: $data['deleteAll'] = false; no delete action
  },
} satisfies Record<string, ListDefinition>;

export type ListKey = keyof typeof LIST_DEFINITIONS;

export function getListDefinition(key: string): ListDefinition | null {
  return Object.prototype.hasOwnProperty.call(LIST_DEFINITIONS, key)
    ? (LIST_DEFINITIONS as Record<string, ListDefinition>)[key]
    : null;
}

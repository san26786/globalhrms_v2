/**
 * Utilities → Dashboard Menu — shared types.
 */

export interface DashboardMenuListItem {
  /** menu_config.ID — primary key used for edit/delete routes. */
  id: number;
  /** menu_config.MSTR_ID — the epic's independent_mst.MSTR_ID. */
  mstrId: number;
  menuName: string;
  url: string;
  sequence: number | null;
  showTab: boolean;
  showMenu: boolean;
}

export interface DashboardMenuDetail extends DashboardMenuListItem {
  menuCode: string | null;
  smallViewIcon: string | null;
  mediumViewIcon: string | null;
  blockMenuIcon: string | null;
}

export interface DashboardMenuParentOption {
  /** independent_mst.MSTR_ID of the child module — the value CI's dropdown posted as parent_module. */
  value: number;
  label: string;
}

export interface CreateDashboardMenuInput {
  parentModuleId: number | null;
  menuCode: string;
  menuName: string;
  menuUrl: string;
  sequence: number;
}

export interface UpdateDashboardMenuInput {
  menuName: string;
  menuUrl: string;
  sequence: number;
}

export interface DashboardMenuIconFiles {
  small?: File | null;
  medium?: File | null;
  block?: File | null;
}

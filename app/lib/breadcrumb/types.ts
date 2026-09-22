export type BreadcrumbMode = 'list' | 'add' | 'edit' | 'view' | string;

/**
 * CI: mirrors what get_parent_by_url() populates via its $returned_url
 * out-param plus $parent->PARENT_NAME / $parent->MENU_NAME.
 */
export interface ParentMenuInfo {
  parentName: string;
  menuName: string;
  returnedUrl: string;
}



import type { ParentMenuInfo } from './types';

/**
 * CI: get_parent_by_url() from common_helper.php was not shared, so this is
 * a placeholder only. In the PHP source it resolves a menu's parent by its
 * URL — presumably via menu_config / menu_config_vw, the same table backing
 * the dashboard-menu module — and returns the parent's PARENT_NAME, the
 * menu's own MENU_NAME, and the menu's canonical URL (the $returned_url
 * by-reference param).
 *
 * TODO: share get_parent_by_url()'s PHP source (and confirm which column
 * on menu_config holds the parent-id) so this can be ported for real
 * instead of stubbed as null.
 */
export async function getParentByUrl(
  passedUrl: string | null,
): Promise<ParentMenuInfo | null> {
  if (!passedUrl) return null;
  return null; // placeholder — always falls to the "no parent" branch for now
}
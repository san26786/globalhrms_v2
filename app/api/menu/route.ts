/**
 * GET /api/menu               -> the caller's left menu (CI left_menu_v), rooted at 370
 * GET /api/menu?parentId=123  -> the sub-tree below one node (CI get_menu_from_relationship($parent_id))
 * GET /api/menu?showTabs=1    -> only SHOW_TAB = 1 rows (CI $show_tabs)
 *
 * Response: { success, data: { menu: MenuNode[] } } — every node carries its resolved Next link.
 */
import { withApi, readQuery } from '@/lib/http/withApi';
import { ValidationError } from '@/lib/http/errors';
import { getNavigationMenu } from '@/lib/navigation/navigationService';

export const dynamic = 'force-dynamic';

export const GET = withApi(async ({ req, subject }) => {
  const query = readQuery(req);
  let parentId: number | undefined;
  if (query.parentId !== undefined && query.parentId !== '') {
    parentId = Number(query.parentId);
    if (!Number.isInteger(parentId) || parentId <= 0) throw new ValidationError('parentId must be a positive integer.');
  }
  const menu = await getNavigationMenu(subject, { parentId, showTabs: query.showTabs === '1' });
  return { menu };
});

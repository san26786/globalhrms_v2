import { NotFoundError } from '@/lib/http/errors';
import { withApi } from '@/lib/http/withApi';
import { getChildMenu } from '@/lib/navigation/navigationService';

/**
 * CI dashboard/dashboard/ChildMenu/{id} — GET → { menuId, title, items }: the menu's name and the
 * caller's permitted items one level below it, each with its resolved link (lib/navigation).
 */
export const dynamic = 'force-dynamic';

export const GET = withApi<{ id: string }>(async ({ params, subject }) => {
  const menuId = Number(params.id);
  if (!Number.isInteger(menuId) || menuId <= 0) throw new NotFoundError('Menu not found.');
  return getChildMenu(subject, menuId);
});

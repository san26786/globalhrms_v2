/**
 * GET /api/navigation/access?path=/user/user_master&search=typeId%3D5
 * Page-level permission decision used by the dashboard layout's route guard.
 */
import { withApi, readQuery } from '@/lib/http/withApi';
import { ValidationError } from '@/lib/http/errors';
import { checkPageAccess } from '@/lib/navigation/navigationService';

export const dynamic = 'force-dynamic';

export const GET = withApi(async ({ req, subject }) => {
  const { path, search = '' } = readQuery(req);
  if (!path || !path.startsWith('/')) throw new ValidationError('path must be an absolute app path.');
  return checkPageAccess(subject, path, new URLSearchParams(search));
});

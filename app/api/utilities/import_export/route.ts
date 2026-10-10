import { withApi } from '@/lib/http/withApi';
import { authorizeScreen, requireAdmin } from '@/lib/utilities/access';
import { listExportableTables } from '@/lib/utilities/tableExport';

/** GET /api/utilities/import_export — the whitelisted tables (CI offered every database table). */
export const GET = withApi(async ({ subject }) => {
  await authorizeScreen(subject, 'import_export', 'list');
  requireAdmin(subject);
  return listExportableTables();
});

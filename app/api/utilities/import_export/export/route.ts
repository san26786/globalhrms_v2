import { readQuery, withApi } from '@/lib/http/withApi';
import { tableExportQuerySchema } from '@/validations/utilities.schema';
import { authorizeScreen, requireAdmin, resolveBrand } from '@/lib/utilities/access';
import { exportTableCsv } from '@/lib/utilities/tableExport';
import { csvResponse } from '@/lib/utilities/csv';

/**
 * GET /api/utilities/import_export/export?table=&oaBrandId= — CI import_export/export/{table}/{oa}/{brand}.
 * The table must be whitelisted; rows are always limited to one validated brand (default: active brand).
 */
export const GET = withApi(async ({ req, subject }) => {
  await authorizeScreen(subject, 'import_export', 'read');
  requireAdmin(subject);
  const query = tableExportQuerySchema.parse(readQuery(req));
  const brand = await resolveBrand(subject, query.oaBrandId);
  const { filename, csv } = await exportTableCsv(query.table, brand);
  return csvResponse(filename, csv);
});

import { readQuery, withApi } from '@/lib/http/withApi';
import { exportEmployeeQuerySchema } from '@/validations/utilities.schema';
import { authorizeScreen, requireAdmin, resolveBrand } from '@/lib/utilities/access';
import { buildEmployeeCsv } from '@/lib/utilities/exportEmployee';
import { csvResponse, todayStamp } from '@/lib/utilities/csv';

/**
 * GET /api/utilities/export_employee?withData=0|1 — CI export_employee/export.
 * Always the caller's active brand; administrators only (the file contains Aadhar / PAN numbers).
 */
export const GET = withApi(async ({ req, subject }) => {
  await authorizeScreen(subject, 'export_employee', 'read');
  requireAdmin(subject);
  const { withData } = exportEmployeeQuerySchema.parse(readQuery(req));
  const brand = await resolveBrand(subject, subject.oaBrandId);
  const csv = await buildEmployeeCsv(brand.oaBrandId, withData === '1');
  return csvResponse(`Employee_Data_${todayStamp()}.csv`, csv);
});
